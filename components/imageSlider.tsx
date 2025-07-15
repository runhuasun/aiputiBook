import React, { useState, useEffect } from 'react';
import prisma from "../lib/prismadb";
import {Room, Prompt, Model } from "@prisma/client";

const PromptSlider = ({ code }:{code:string}) => {
  const [images, setImages] = useState<Room[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const getImages = async () => {
      const result = await prisma.room.findMany({
        where: {
          model: code
        },
        orderBy: {
          viewTimes: 'desc',
        },
        take: 20,
      });
      setImages(result);
    };
    getImages();
  }, [code]);

  const handlePlayButtonClick = () => {
    setIsPlaying(true);
    setInterval(() => {
      setCurrentIndex((currentIndex + 1) % images.length);
    }, 1000);
  };

  const handlePauseButtonClick = () => {
    setIsPlaying(false);
  };

  return (
    <div className="relative">
      <img src={images[currentIndex]?.outputImage} alt="Image" className="w-full h-auto" />
      {!isPlaying && (
        <button
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md"
          onClick={handlePlayButtonClick}
        >
          <i className="fas fa-play"></i>
        </button>
      )}
      {isPlaying && (
        <button
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md"
          onClick={handlePauseButtonClick}
        >
          <i className="fas fa-pause"></i>
        </button>
      )}
      <div className="hidden" id="image-slider">
        {images.map((image) => (
          <img
            key={image.id}
            src={image.outputImage}
            alt={`Image ${image.id}`}
            className="w-full h-auto hidden"
          />
        ))}
      </div>
    </div>
  );
};

export default PromptSlider;
