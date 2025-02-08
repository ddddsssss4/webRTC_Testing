import React from 'react';
import { BrowserRouter , Routes , Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import VideoRoom from './components/VideoRoom';
import Priceless from './components/priceless';

function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route path = "/" element = {<LandingPage/>}/>
      <Route path = "/create" element = {<CreateRoom/>}/>
      <Route path = "/join" element = {<JoinRoom/>}/>
      <Route path = "/room/:roomId" element = {<VideoRoom/>}/>
      <Route path = "/priceless" element = {<Priceless/>}/>
    </Routes>
    </BrowserRouter>
  )
}

export default App;