
import { BrowserRouter , Routes , Route } from 'react-router-dom';
import LandingPage from './Pages/LandingPage';
import CreateRoom from './Pages/CreateRoom';
import JoinRoom from './Pages/JoinRoom';
import VideoRoom from './Pages/VideoRoom';
import VideoRoomClone from './Pages/priceless';

function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route path = "/" element = {<LandingPage/>}/>
      <Route path = "/create" element = {<CreateRoom/>}/>
      <Route path = "/join" element = {<JoinRoom/>}/>
      <Route path = "/room/:roomId" element = {<VideoRoomClone/>}/>
      <Route path = "/priceless" element = {<VideoRoomClone/>}/>
    </Routes>
    </BrowserRouter>
  )
}

export default App;