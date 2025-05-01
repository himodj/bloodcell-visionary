import React, { useState, useRef } from 'react';
import { useAnalysis } from '../contexts/AnalysisContext';
import { handleImageUpload, analyzeImage, resizeImageWithCenterCrop } from '../utils/analysisUtils';
import { Button } from '@/components/ui/button';
import { Upload, ImagePlus, X, Microscope, Camera } from 'lucide-react';
import { toast } from 'sonner';

const ImageUploader: React.FC = () => {
  const { setOriginalImage, startAnalysis, originalImage, isAnalyzing, finishAnalysis } = useAnalysis();
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const imageDataUrl = await handleImageUpload(files[0]);
        setOriginalImage(imageDataUrl);
        toast.success('Image uploaded and resized to 360x360 with center crop');
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        }
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      try {
        const imageDataUrl = await handleImageUpload(files[0]);
        setOriginalImage(imageDataUrl);
        toast.success('Image uploaded successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        }
      }
    }
  };
  
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleRemoveImage = () => {
    setOriginalImage(null);
    stopCamera();
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', // Prefer rear camera on mobile
            width: { ideal: 1080 },
            height: { ideal: 1080 } 
          } 
        });
        videoRef.current.srcObject = stream;
        toast.success('Camera started - position your sample in the center');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      try {
        // Take a square crop from the center of the video
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        // First create a temporary canvas with the cropped image
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        
        // Draw from the center of the video to create a square image
        ctx.drawImage(
          video, 
          startX, startY, size, size, // Source rectangle
          0, 0, size, size // Destination rectangle (exact crop size)
        );
        
        // Convert to data URL
        const croppedImageDataUrl = canvas.toDataURL('image/png');
        
        // Now resize to exactly 360x360
        const resizedImageDataUrl = await resizeImageWithCenterCrop(croppedImageDataUrl);
        
        // Set the image and close camera
        setOriginalImage(resizedImageDataUrl);
        stopCamera();
        toast.success('Image captured and resized to 360x360');
        
        console.log('Image dimensions: 360x360 (center cropped and resized)');
      } catch (error) {
        console.error('Error capturing image:', error);
        toast.error('Failed to capture image');
      }
    }
  };

  const handleStartAnalysis = async () => {
    if (!originalImage) {
      toast.error('Please upload an image first');
      return;
    }
    
    try {
      startAnalysis();
      const result = await analyzeImage(originalImage);
      finishAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      if (error instanceof Error) {
        toast.error(`Analysis failed: ${error.message}`);
      } else {
        toast.error('Analysis failed with an unknown error');
      }
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mb-8 animate-scale-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-medium mb-2">Blood Cell Analysis</h2>
        <p className="text-medical-dark text-opacity-70 max-w-md mx-auto text-balance">
          Upload a blood sample image or capture one directly. Images will be center-cropped and resized to 360x360 for optimal model performance.
        </p>
      </div>
      
      {showCamera ? (
        <div className="rounded-xl overflow-hidden medical-card">
          <div className="relative bg-black">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-auto max-h-[400px] object-contain mx-auto"
              style={{ maxWidth: '100%' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
              <Button 
                onClick={captureImage} 
                className="neo-button bg-medical-blue text-white hover:bg-medical-blue/90"
              >
                <Camera size={16} className="mr-2" />
                Capture
              </Button>
              <Button 
                onClick={stopCamera} 
                className="neo-button bg-medical-red text-white hover:bg-medical-red/90"
              >
                <X size={16} className="mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : !originalImage ? (
        <div
          className={`rounded-xl border-2 border-dashed p-10 transition-all duration-300 
                    ${isDragging ? 'border-medical-blue bg-medical-blue bg-opacity-5' : 'border-gray-200'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-medical-blue bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImagePlus className="text-medical-blue" size={24} />
            </div>
            <h3 className="font-medium text-lg mb-2">Upload Blood Sample Image</h3>
            <p className="text-sm text-medical-dark text-opacity-60 mb-6 max-w-xs mx-auto">
              Drag and drop your image here, or select one of the options below
            </p>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                onClick={handleUploadClick}
                className="neo-button bg-medical-blue text-white hover:bg-medical-blue/90"
              >
                <Upload size={16} className="mr-2" />
                Upload Image
              </Button>
              
              <Button 
                onClick={startCamera}
                className="neo-button bg-medical-blue text-white hover:bg-medical-blue/90"
              >
                <Camera size={16} className="mr-2" />
                Use Camera
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden medical-card">
          <div className="relative">
            <img
              src={originalImage}
              alt="Blood Sample"
              className="w-full h-auto max-h-[400px] object-contain bg-black"
            />
            <button
              className="absolute top-2 right-2 bg-black bg-opacity-70 text-white rounded-full p-1"
              onClick={handleRemoveImage}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="p-4 text-center">
            <Button 
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="neo-button bg-medical-red text-white hover:bg-medical-red/90 w-full"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Microscope size={16} className="mr-2" />
                  Start Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
