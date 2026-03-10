import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import './App.css';
import { Provider } from 'react-redux';
import store from './store';

import { MediaStreamProvider } from './contexts/MediaStreamContext';

const Homepage = lazy(() => import('./components/basic/homepage/homepage'));
const Dashboard = lazy(() => import('./components/dashboard/backbone'));
const TraineeRegister = lazy(() => import('./components/trainee/register/traineeregister'));
const MainPortal = lazy(() => import('./components/trainee/examPortal/portal'));

function LegacyExamineeRedirect({ target }) {
  const location = useLocation();
  return <Navigate to={`${target}${location.search || ''}`} replace />;
}

function App() {
  return (
    <Provider store={store}>
      <MediaStreamProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="app-route-loader">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/home" element={<Homepage />} />
              <Route path="/user" element={<Navigate to="/user/home" replace />} />
              <Route path="/user/:options" element={<Dashboard />} />
              <Route path="/trainee/register" element={<LegacyExamineeRedirect target="/examinee/register" />} />
              <Route path="/trainee/taketest" element={<LegacyExamineeRedirect target="/examinee/taketest" />} />
              <Route path="/examinee/register" element={<TraineeRegister />} />
              <Route path="/examinee/taketest" element={<MainPortal />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MediaStreamProvider>
    </Provider> 
  );
}

export default App;
