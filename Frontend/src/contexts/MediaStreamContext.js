import React, { useState, createContext } from 'react';

export const MediaStreamContext = createContext({
  mediaStream: null,
  setMediaStream: () => {},
  controlChannel: null,
  setControlChannel: () => {},
});

export const MediaStreamProvider = ({ children }) => {
  const [mediaStream, setMediaStream] = useState(null);
  const [controlChannel, setControlChannel] = useState(null); 

  return (
    <MediaStreamContext.Provider
      value={{
        mediaStream,
        setMediaStream,
        controlChannel,
        setControlChannel, 
      }}
    >
      {children}
    </MediaStreamContext.Provider>
  );
};
