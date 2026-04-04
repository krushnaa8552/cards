import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './roomCard.css';

const HAND_SIZES = [7, 10, 13];

const PFP_LIST = [
  'avatar',
  'cat1','cat2','cat3','cat4','cat5',
  'cat6','cat7','cat8','cat9','cat10','cat11',
];

const pfpSrc = (name) =>
  new URL(`../../assets/pfp/${name}.jpeg`, import.meta.url).href;

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
    const [pfp, setPfp] = useState('avatar');
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef(null);
    const navigate = useNavigate();

    // Close picker on outside click
    useEffect(() => {
        const handler = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Step 1 for create: generate the room code locally, no API call yet
    const handleGenerateCode = () => {
        if (!username.trim()) return setError('Enter a Username');
        setError('');

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

        // Persist everything locally so pfp can still be changed before entering
        localStorage.setItem('pendingRoom', JSON.stringify({ username: username.trim(), handSize, code }));
        localStorage.setItem('username', username.trim());
        localStorage.setItem('pfp', pfp);

        setGeneratedCode(code);
    };

    // Step 2 for create: actually create the room with the latest pfp, then navigate
    const handleEnterRoom = async () => {
        setLoading(true);
        setError('');
        try {
            const pending = JSON.parse(localStorage.getItem('pendingRoom') || '{}');
            const res = await fetch('http://localhost:5000/api/room/start-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: pending.username,
                    handSize: pending.handSize,
                    pfp,               // use current pfp (may have changed after code gen)
                    code: pending.code // pass the code we already showed the user
                })
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error || 'Failed to create room');

            localStorage.setItem('guestToken', data.guestToken);
            localStorage.setItem('playerId', data.playerId);
            localStorage.setItem('roomId', data.roomId);
            localStorage.setItem('handSize', data.handSize ?? pending.handSize);
            localStorage.setItem('pfp', pfp);
            localStorage.removeItem('pendingRoom');

            navigate(`/lobby/${generatedCode}`);
        } catch {
            setError('Failed to create room');
        } finally {
            setLoading(false);
        }
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
                body: JSON.stringify({ code: code.trim().toUpperCase(), username: username.trim(), pfp })
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
            localStorage.setItem('pfp', pfp);

            navigate(`/lobby/${data.code}`);
        } catch {
            setError('Server Error');
        } finally {
            setLoading(false);
        }
    };

    const PfpPicker = () => (
        <div className="pfp-wrapper" ref={pickerRef}>
            {pickerOpen && (
                <div className="pfp-picker">
                    {PFP_LIST.map(name => (
                        <button
                            key={name}
                            type="button"
                            className={`pfp-option ${pfp === name ? 'pfp-option--active' : ''}`}
                            onClick={() => { setPfp(name); setPickerOpen(false); }}
                        >
                            <img src={pfpSrc(name)} alt={name} />
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                className="pfp-trigger"
                onClick={() => setPickerOpen(o => !o)}
                title="Choose avatar"
            >
                <img src={pfpSrc(pfp)} alt="avatar" />
            </button>
        </div>
    );

    if (mode === 'create') {
        return (
            <div className="room">
                <div className="form">
                    <PfpPicker />
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
                        <button className="btn btn-primary" onClick={handleGenerateCode} disabled={loading}>
                            generate code
                        </button>
                    ) : (
                        <>
                            <div className="code-display">
                                <span className="code-text">{generatedCode}</span>
                                <button className="btn-copy" onClick={handleCopy}>
                                    {copied ? 'copied!' : 'copy'}
                                </button>
                            </div>
                            <button className="btn btn-primary" onClick={handleEnterRoom} disabled={loading}>
                                {loading ? '...' : 'enter room'}
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
                <PfpPicker />
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