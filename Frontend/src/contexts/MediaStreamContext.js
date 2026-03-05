import React, { useState, createContext } from 'react';

export const MediaStreamContext = createContext({
  mediaStream: null,
  setMediaStream: () => {},
  screenStream: null,
  setScreenStream: () => {},
  controlChannel: null,
  setControlChannel: () => {},
});

export const MediaStreamProvider = ({ children }) => {
  const [mediaStream, setMediaStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [controlChannel, setControlChannel] = useState(null); 

  return (
    <MediaStreamContext.Provider
      value={{
        mediaStream,
        setMediaStream,
        screenStream,
        setScreenStream,
        controlChannel,
        setControlChannel, 
      }}
    >
      {children}
    </MediaStreamContext.Provider>
  );
};
