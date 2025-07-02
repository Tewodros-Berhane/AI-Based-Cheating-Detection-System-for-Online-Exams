import React from 'react';
import { BrowserRouter, Route } from "react-router-dom";
import './App.css';
import { Provider } from 'react-redux';
import store from './store';

import Homepage from './components/basic/homepage/homepage';
import Dashboard from './components/dashboard/backbone';
import TraineeRegister from './components/trainee/register/traineeregister';
import MainPortal from './components/trainee/examPortal/portal';

// Import the MediaStreamProvider
import { MediaStreamProvider } from './contexts/MediaStreamContext';

function App() {
  return (
    <Provider store={store}>
      <MediaStreamProvider>
        <BrowserRouter>
          <nav>
            <Route exact path="/" component={Homepage} />
            <Route exact path="/home" component={Homepage} />
            <Route exact path="/user" component={Dashboard}/>
            <Route path="/user/:options" component={Dashboard}/>
            <Route exact path="/trainee/register" component={TraineeRegister}/>
            <Route exact path="/trainee/taketest" component={MainPortal}/>
          </nav>
        </BrowserRouter>
      </MediaStreamProvider>
    </Provider> 
  );
}

export default App;
