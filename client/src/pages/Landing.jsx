import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div>
            <div>
                {/* <buttom className='rules-btn' onClick={() => navigate('/how-to-play')} >Rules</buttom> */}
            </div>
            <div className="landing">
                <button className="btn-primary" onClick={() => navigate('/start-game')}>
                    Create Room
                </button>
                <button className="btn-secondary" onClick={() => navigate('/join-game')}>
                    Join Room
                </button>
            </div>
        </div>
    );
};

export default Landing;