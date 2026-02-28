import { useEffect } from 'react';
import { acquireResultSocket, releaseResultSocket } from '../../services/traineeSession';

export default function TraineeSessionManager({ traineeId, testId }) {
  useEffect(() => {
    if (!traineeId) return undefined;

    acquireResultSocket(traineeId, testId);
    return () => {
      releaseResultSocket();
    };
  }, [traineeId, testId]);

  return null;
}
