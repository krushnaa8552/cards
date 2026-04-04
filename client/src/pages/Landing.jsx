import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="landing">
            <button className="btn-primary" onClick={() => navigate('/start-game')}>
                Create Room
            </button>
            <button className="btn-secondary" onClick={() => navigate('/join-game')}>
                Join Room
            </button>
        </div>
    );
};

export default Landing;