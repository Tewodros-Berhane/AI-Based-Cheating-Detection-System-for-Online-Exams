import React, { useCallback, useState, createContext } from 'react';

export const MediaStreamContext = createContext({
  mediaStream: null,
  setMediaStream: () => {},
  screenStream: null,
  setScreenStream: () => {},
  controlChannel: null,
  setControlChannel: () => {},
  clearMediaResources: () => {},
});

export const MediaStreamProvider = ({ children }) => {
  const [mediaStream, setMediaStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [controlChannel, setControlChannel] = useState(null);

  const stopStreamTracks = useCallback((stream) => {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        console.warn('Failed to stop media track:', error);
      }
    });
  }, []);

  const clearMediaResources = useCallback(() => {
    stopStreamTracks(mediaStream);
    stopStreamTracks(screenStream);

    if (controlChannel && typeof controlChannel.close === 'function' && controlChannel.readyState !== 'closed') {
      try {
        controlChannel.close();
      } catch (error) {
        console.warn('Failed to close control channel:', error);
      }
    }

    setMediaStream(null);
    setScreenStream(null);
    setControlChannel(null);
  }, [controlChannel, mediaStream, screenStream, stopStreamTracks]);

  return (
    <MediaStreamContext.Provider
      value={{
        mediaStream,
        setMediaStream,
        screenStream,
        setScreenStream,
        controlChannel,
        setControlChannel,
        clearMediaResources,
      }}
    >
      {children}
    </MediaStreamContext.Provider>
  );
};
