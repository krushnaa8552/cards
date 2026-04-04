import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Landing from "./pages/Landing.jsx";
import RoomCard from './components/RoomCard/roomCard.jsx';
import Room from './components/Room/Room.jsx';
import Lobby from './components/Lobby/Lobby.jsx';
import GameOver from './components/GameOver/GameOver.jsx';
import './App.css';

const AppRoutes = () => {
  const navigate = useNavigate();

  const onJoin = (roomCode, username, { playerId, guestToken } = {}) => {
    localStorage.setItem('roomCode',   roomCode);
    localStorage.setItem('username',   username);
    if (playerId)   localStorage.setItem('playerId',   playerId);
    if (guestToken) localStorage.setItem('guestToken', guestToken);

    navigate(`/lobby/${roomCode}`);
  };

  return (
    <Routes>
      <Route path="/"                          element={<Landing onJoin={onJoin} />} />
      <Route path="/start-game"                element={<RoomCard mode="create" onJoin={onJoin} />} />
      <Route path="/join-game"                 element={<RoomCard mode="join"   onJoin={onJoin} />} />
      <Route path="/lobby/:roomCode"           element={<Lobby />} />
      <Route path="/room/:roomCode"            element={<Room />} />
      <Route path="/room/:roomCode/game-over"  element={<GameOverRoute />} />
    </Routes>
  );
};

// Reads winner state from location, falls back gracefully
const GameOverRoute = () => {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const location = useLocation();
  const playerId = localStorage.getItem('playerId');

  const state = location.state || {};

  // If someone lands here directly without state, bounce them out
  if (!state.winnerId) {
    navigate('/');
    return null;
  }

  return (
    <GameOver
      winnerId={state.winnerId}
      winnerName={state.winnerName}
      allHands={state.allHands || []}
      playerId={playerId}
      onBack={() => navigate('/')}
    />
  );
};

// Need these imports for GameOverRoute
import { useParams, useLocation } from 'react-router-dom';

const App = () => (
  <Router>
    <AppRoutes />
  </Router>
);

export default App;