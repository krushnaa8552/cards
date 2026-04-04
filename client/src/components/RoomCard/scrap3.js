import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './roomCard.css';

const HAND_SIZES = [7, 10, 13];

const RoomCard = ({ mode }) => {
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState(null);
    const [roomId, setRoomId] = useState(null);
    const [playerId, setPlayerId] = useState(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [handSize, setHandSize] = useState(13);
    const navigate = useNavigate();

    // Step 1 for create: generate the room code
    const handleGenerateCode = async () => {
        if (!username.trim()) return setError('Enter a Username');
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/room/start-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), handSize })
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error || 'Failed to create room');

            localStorage.setItem('guestToken', data.guestToken);
            localStorage.setItem('playerId', data.playerId);
            localStorage.setItem('roomId', data.roomId);
            localStorage.setItem('handSize', data.handSize ?? handSize);

            setGeneratedCode(data.code);
            setRoomId(data.roomId);
            setPlayerId(data.playerId);
        } catch {
            setError('Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    // Step 2 for create: enter the room
    const handleEnterRoom = () => {
        navigate(`/room/${generatedCode}`);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Join flow (unchanged)
    const handleJoin = async () => {
        if (!username.trim()) return setError('Enter a Username');
        if (!code.trim()) return setError('Enter Room Code');
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/room/join-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim().toUpperCase(), username: username.trim() })
            });
            if (!res.ok) {
                const d = await res.json();
                return setError(d.error || 'Room not found');
            }
            const data = await res.json();

            localStorage.setItem('guestToken', data.guestToken);
            localStorage.setItem('playerId', data.playerId);
            localStorage.setItem('roomId', data.roomId);
            localStorage.setItem('handSize', data.handSize ?? 13);

            navigate(`/room/${data.code}`);
        } catch {
            setError('Server Error');
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'create') {
        return (
            <div className="room">
                <div className="form">
                    <input
                        className="input"
                        placeholder="username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        maxLength={30}
                        autoFocus
                        disabled={!!generatedCode}
                    />

                    {!generatedCode && (
                        <div className="hand-size-selector">
                            <span className="hand-size-label">cards per player</span>
                            <div className="hand-size-options">
                                {HAND_SIZES.map(size => (
                                    <button
                                        key={size}
                                        className={`hand-size-btn ${handSize === size ? 'hand-size-btn--active' : ''}`}
                                        onClick={() => setHandSize(size)}
                                        type="button"
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && <p className="error">{error}</p>}

                    {!generatedCode ? (
                        <button className="btn btn-primary" onClick={() => { handleGenerateCode(); localStorage.setItem('username', username.trim()); }} disabled={loading}>
                            {loading ? '...' : 'generate code'}
                        </button>
                    ) : (
                        <>
                            <div className="code-display">
                                <span className="code-text">{generatedCode}</span>
                                <button className="btn-copy" onClick={handleCopy}>
                                    {copied ? 'copied!' : 'copy'}
                                </button>
                            </div>
                            <button className="btn btn-primary" onClick={() => { handleEnterRoom(); localStorage.setItem('username', username.trim()); }}>
                                enter room
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="room">
            <div className="form">
                <input
                    className="input"
                    placeholder="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    maxLength={30}
                    autoFocus
                />
                <input
                    className="input-code"
                    placeholder="room code"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />

                {error && <p className="error">{error}</p>}

                <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
                    {loading ? '...' : 'enter room'}
                </button>
            </div>
        </div>
    );
};

export default RoomCard;