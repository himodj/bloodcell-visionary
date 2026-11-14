#!/usr/bin/env python3
"""
Convert a BloodCellVision Keras model (.h5) to the ONNX file used by the desktop app.

Why this exists
---------------
model.h5 was saved by Keras 3 with an incomplete top-level InputLayer entry (no shape),
so keras.models.load_model() refuses to open it - on any Python/Keras version. That is the
"model will not load" problem of BloodCellVision 1.x.

This script does not use load_model(). It rebuilds the network from the architecture stored
inside the file (EfficientNetV2-B0 backbone + classification head), copies every trained
weight across by layer name, exports to ONNX and then proves that the ONNX file gives the
same answers as the Keras network.

You only need this when you retrain the model. The app itself needs no Python at all.

Usage
-----
    pip install "tensorflow-cpu>=2.16" tf2onnx onnx onnxruntime h5py numpy
    python tools/convert_h5_to_onnx.py model.h5 resources/model/bloodcell.onnx

If the retrained model has different classes, edit the "labels" list in
resources/model/bloodcell.json so that it follows the training class order
(train_generator.class_indices).
"""
import argparse
import copy
import json
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import h5py
import numpy as np


def weight_names(group):
    return [n.decode() if isinstance(n, bytes) else n for n in group.attrs["weight_names"]]


def rebuild(h5_path):
    import keras

    f = h5py.File(h5_path, "r")
    raw = f.attrs["model_config"]
    config = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    if config["class_name"] != "Sequential":
        sys.exit(f"Unexpected top-level model type: {config['class_name']}")
    layers_cfg = [l for l in config["config"]["layers"] if l["class_name"] != "InputLayer"]
    backbone_cfg, head_cfgs = layers_cfg[0], layers_cfg[1:]
    if backbone_cfg["class_name"] != "Functional":
        sys.exit("Expected the first layer to be the EfficientNetV2 backbone.")

    backbone_name = backbone_cfg["config"]["name"]
    backbone = keras.Model.from_config(copy.deepcopy(backbone_cfg["config"]))
    input_shape = tuple(backbone.input_shape[1:])
    image = keras.Input(input_shape, name="image")
    x = backbone(image)
    if isinstance(x, (list, tuple)):
        x = x[0]
    head = []
    for cfg in head_cfgs:
        layer = keras.saving.deserialize_keras_object(
            {"module": "keras.layers", "class_name": cfg["class_name"], "config": cfg["config"], "registered_name": None}
        )
        head.append(layer)
        x = layer(x)
    model = keras.Model(image, x, name="bloodcellvision")

    # --- copy the trained weights, matched by layer name, with shape checks
    weights_root = f["model_weights"]
    backbone_group = weights_root[backbone_name]
    by_layer = {}
    for name in weight_names(backbone_group):
        by_layer.setdefault(name.split("/")[-2], []).append(np.array(backbone_group[name]))
    copied = 0
    for layer in backbone.layers:
        if not layer.weights:
            continue
        values = by_layer.get(layer.name)
        if values is None or len(values) != len(layer.weights):
            sys.exit(f"Weights for backbone layer '{layer.name}' are missing in the file.")
        for w, v in zip(layer.weights, values):
            if tuple(w.shape) != v.shape:
                sys.exit(f"Shape mismatch in '{layer.name}': {tuple(w.shape)} vs {v.shape}")
        layer.set_weights(values)
        copied += len(values)
    for layer in head:
        if not layer.weights:
            continue
        group = weights_root[layer.name]
        values = [np.array(group[n]) for n in weight_names(group)]
        if len(values) != len(layer.weights):
            sys.exit(f"Weights for head layer '{layer.name}' are missing in the file.")
        for w, v in zip(layer.weights, values):
            if tuple(w.shape) != v.shape:
                sys.exit(f"Shape mismatch in '{layer.name}': {tuple(w.shape)} vs {v.shape}")
        layer.set_weights(values)
        copied += len(values)
    if copied != len(model.weights):
        sys.exit(f"Only {copied} of {len(model.weights)} weight tensors were found.")
    print(f"Rebuilt network: input {model.input_shape}, output {model.output_shape}, "
          f"{model.count_params():,} parameters, {copied} weight tensors copied.")
    return model


def export_onnx(model, onnx_path):
    import keras
    import onnx
    from onnx import numpy_helper

    shape = tuple(model.input_shape[1:])
    model(np.zeros((1, *shape), "float32"))
    tmp = onnx_path + ".tmp"
    model.export(tmp, format="onnx", verbose=False,
                 input_signature=[keras.InputSpec(shape=(None, *shape), dtype="float32", name="image")])

    # Keras exports the backbone's normalisation constants as extra graph *inputs*.
    # Turn them into constants stored in the file so the model has a single input.
    m = onnx.load(tmp)
    os.remove(tmp)
    g = m.graph
    norm = [l for l in model.layers[1].layers if l.__class__.__name__ == "Normalization"]
    mean = np.asarray(norm[0].mean, "float32").reshape(-1) if norm else None
    variance = np.asarray(norm[0].variance, "float32").reshape(-1) if norm else None
    used = {i for node in g.node for i in node.input}
    keep = []
    for inp in g.input:
        if inp.name == "image":
            keep.append(inp)
            continue
        dims = [d.dim_value for d in inp.type.tensor_type.shape.dim]
        if inp.name.endswith("Sub/y:0") and mean is not None:
            value = mean
        elif inp.name.endswith("Sqrt/x:0") and variance is not None:
            value = variance
        else:
            sys.exit(f"Unexpected extra model input: {inp.name}")
        if inp.name in used:
            g.initializer.append(numpy_helper.from_array(value.reshape(dims), inp.name))
    del g.input[:]
    g.input.extend(keep)
    g.output[0].name, old = "probabilities", g.output[0].name
    for node in g.node:
        for i, o in enumerate(node.output):
            if o == old:
                node.output[i] = "probabilities"
    onnx.checker.check_model(m)
    onnx.save(m, onnx_path)
    print(f"Saved {onnx_path} ({os.path.getsize(onnx_path) / 1e6:.1f} MB, opset {m.opset_import[0].version}).")


def verify(model, onnx_path):
    import onnxruntime as ort

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    assert [i.name for i in session.get_inputs()] == ["image"]
    shape = tuple(model.input_shape[1:])
    rng = np.random.default_rng(0)
    worst = 0.0
    for k in range(8):
        x = (rng.random((2, *shape), dtype=np.float32) * rng.uniform(0.3, 1.0) + rng.uniform(0, 0.2)).clip(0, 1)
        a = np.asarray(model(x, training=False))
        b = session.run(None, {"image": x})[0]
        worst = max(worst, float(np.abs(a - b).max()))
        if not (a.argmax(1) == b.argmax(1)).all():
            sys.exit("ONNX and Keras disagree on the predicted class - do not use this file.")
    print(f"Verification: ONNX matches Keras (largest probability difference {worst:.2e}).")
    if worst > 1e-3:
        sys.exit("Difference is larger than expected - do not use this file.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("h5", help="path to the trained Keras model (.h5)")
    parser.add_argument("onnx", help="output path, e.g. resources/model/bloodcell.onnx")
    args = parser.parse_args()
    model = rebuild(args.h5)
    export_onnx(model, args.onnx)
    verify(model, args.onnx)
    print("Done.")


if __name__ == "__main__":
    main()
