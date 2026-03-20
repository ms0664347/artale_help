import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, update, remove, get, set } from 'firebase/database';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';

const AVAILABLE_COLORS = [
  { id: 'red', hex: '#ef4444' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
  { id: 'yellow', hex: '#eab308' }
];

const generateId = () => Math.random().toString(36).substring(2, 8);

// --- 1. 大廳頁面 (Lobby) ---
function Lobby() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('menu');
  const [form, setForm] = useState({ roomId: '', password: '' });

  useEffect(() => {
    if (mode === 'create') {
      const randomRoom = Math.floor(10000000 + Math.random() * 90000000).toString();
      setForm(prev => ({ ...prev, roomId: randomRoom, password: '' }));
    } else {
      setForm({ roomId: '', password: '' });
    }
  }, [mode]);

  const handleAction = async () => {
    const cleanRoomId = form.roomId.trim();
    const cleanPassword = form.password.trim();

    if (!cleanRoomId || !cleanPassword) {
      window.Swal.fire({ icon: 'error', title: '請填寫完整', background: '#1a1a1a', color: '#fff' });
      return;
    }

    if (cleanPassword.length !== 4) {
      window.Swal.fire({ icon: 'warning', title: '密碼格式錯誤', text: '請輸入 4 位數字密碼', background: '#1a1a1a', color: '#fff' });
      return;
    }

    const roomRef = ref(db, `rooms/${ cleanRoomId }`);
    const snapshot = await get(roomRef);
    const userUuid = generateId();

    if (mode === 'create') {
      if (snapshot.exists()) {
        window.Swal.fire({ icon: 'error', title: '房號重複，請重試', background: '#1a1a1a', color: '#fff' });
      } else {
        await set(roomRef, { password: cleanPassword, players: {} });
        navigate(`/game/${ cleanRoomId }?u=${ userUuid }&pwd=${ cleanPassword }`);
      }
    } else {
      if (!snapshot.exists() || snapshot.val().password !== cleanPassword) {
        window.Swal.fire({ icon: 'error', title: '房號或密碼錯誤', background: '#1a1a1a', color: '#fff' });
      } else {
        const players = snapshot.val().players || {};
        const playerCount = Object.keys(players).length;

        if (playerCount >= 4) {
          window.Swal.fire({ icon: 'warning', title: '房間已滿', text: '這間房間已經有 4 個人了', background: '#1a1a1a', color: '#fff' });
          return;
        }

        navigate(`/game/${ cleanRoomId }?u=${ userUuid }&pwd=${ cleanPassword }`);
      }
    }
  };

  const btnStyle = {
    padding: '15px 30px', fontSize: '18px', fontWeight: 'bold', borderRadius: '12px',
    border: 'none', cursor: 'pointer', width: '100%', marginBottom: '10px'
  };

  const inputStyle = {
    width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px',
    border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box'
  };

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '900', marginBottom: '10px' }}>Artale</h1>
        <h2 style={{ color: '#888', marginBottom: '40px', fontSize: '16px' }}>羅密歐與祝英台 Helper</h2>

        {mode === 'menu' && (
          <>
            <button onClick={() => setMode('create')} style={{ ...btnStyle, backgroundColor: '#3b82f6', color: '#fff' }}>創建房間</button>
            <button onClick={() => setMode('join')} style={{ ...btnStyle, backgroundColor: '#22c55e', color: '#fff' }}>加入房間</button>
          </>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div style={{ backgroundColor: '#111', padding: '30px', borderRadius: '20px', border: '1px solid #333' }}>
            <h2 style={{ marginBottom: '20px' }}>{mode === 'create' ? '建立新對局' : '進入對局'}</h2>
            {mode === 'create' ? (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#000', borderRadius: '10px', border: '1px dashed #444' }}>
                <div style={{ color: '#666', fontSize: '12px' }}>自動生成房號</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#3b82f6' }}>{form.roomId}</div>
              </div>
            ) : (
              <input
                placeholder="輸入 8 位數房號"
                style={inputStyle}
                value={form.roomId}
                onChange={e => setForm({ ...form, roomId: e.target.value })}
              />
            )}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              placeholder="請輸入 4 位數密碼"
              style={inputStyle}
              value={form.password}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setForm({ ...form, password: val });
              }}
            />
            <button onClick={handleAction} style={{ ...btnStyle, backgroundColor: '#fff', color: '#000', marginTop: '10px' }}>確定</button>
            <p onClick={() => setMode('menu')} style={{ color: '#666', cursor: 'pointer', marginTop: '15px' }}>返回主選單</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 2. 遊戲房間頁面 (GameRoom) ---
function GameRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userUuid = searchParams.get('u');
  const pwd = searchParams.get('pwd');
  const playerKey = `p_${ userUuid }`;

  const [allPlayers, setAllPlayers] = useState({});
  const totalFloors = 10;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!userUuid || !pwd) {
      navigate('/');
      return;
    }
    const roomRef = ref(db, `rooms/${ roomId }`);
    return onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        navigate('/');
        return;
      }
      if (snapshot.val().password !== pwd) {
        window.Swal.fire({ icon: 'error', title: '驗證失敗', background: '#1a1a1a', color: '#fff' });
        navigate('/');
        return;
      }
      setAllPlayers(snapshot.val().players || {});
    });
  }, [roomId, pwd, userUuid, navigate]);

  const handleExitRoom = async () => {
    const roomPath = `rooms/${ roomId }`;
    const playersRef = ref(db, `${ roomPath }/players`);
    try {
      const snapshot = await get(playersRef);
      const currentPlayers = snapshot.val() || {};
      const playerKeys = Object.keys(currentPlayers);
      if (playerKeys.length <= 1 && currentPlayers[playerKey]) {
        await remove(ref(db, roomPath));
      } else {
        await remove(ref(db, `${ roomPath }/players/${ playerKey }`));
      }
    } catch (error) {
      console.error("清除資料失敗:", error);
    }
    navigate('/');
  };

  const handleCopyInfo = () => {
    const textToCopy = `房間：${ roomId }\n密碼：${ pwd }`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      window.Swal.fire({ title: '已複製', icon: 'success', timer: 800, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    });
  };

  const handleColorSelect = (colorHex) => {
    update(ref(db, `rooms/${ roomId }/players/${ playerKey }`), { color: colorHex });
  };

  const handleClearAll = () => {
    window.Swal.fire({
      title: '確定要重置嗎？',
      text: '這會清除所有人的選擇',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: '是的',
      background: '#1a1a1a', color: '#fff'
    }).then((result) => {
      if (result.isConfirmed) {
        remove(ref(db, `rooms/${ roomId }/players`));
      }
    });
  };

  const handleSelect = (floorIndex, cellIndex) => {
    if (!allPlayers[playerKey]?.color) {
      window.Swal.fire({ icon: 'error', title: '請先選顏色！', background: '#1a1a1a', color: '#fff' });
      return;
    }

    // 搶位邏輯：檢查是否有其他人選了這格
    const isTakenByOthers = Object.entries(allPlayers).some(([pKey, data]) => {
      return pKey !== playerKey && data.choices?.[floorIndex] === cellIndex;
    });

    if (isTakenByOthers) {
      window.Swal.fire({ icon: 'warning', title: '這格已經有人囉！', timer: 1000, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
      return;
    }

    const currentChoice = allPlayers[playerKey]?.choices?.[floorIndex];
    const newChoice = currentChoice === cellIndex ? null : cellIndex;
    update(ref(db, `rooms/${ roomId }/players/${ playerKey }/choices`), { [floorIndex]: newChoice });
  };

  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - i - 1);

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', padding: '10px', fontFamily: 'sans-serif' }}>

      {/* 頂部導航欄優化 */}
      <div style={{
        position: 'sticky', top: 0, backgroundColor: 'rgba(0,0,0,0.98)', zIndex: 100,
        borderBottom: '2px solid #333', padding: '0 8px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px',
        height: '100px', boxSizing: 'border-box'
      }}>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '5px' }}>
          <button onClick={handleExitRoom} style={{ backgroundColor: '#333', color: '#eee', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: isMobile ? '12px' : '16px', fontWeight: 'bold', cursor: 'pointer' }}>返回大廳</button>
          <button onClick={handleClearAll} style={{ backgroundColor: '#1a1a1a', color: '#555', border: '1px solid #222', padding: '6px 8px', borderRadius: '6px', fontSize: isMobile ? '12px' : '16px', fontWeight: 'bold' }}>重置全部</button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '26px', fontWeight: '900', color: '#fff', lineHeight: '1.2' }}>房號:{roomId}</h1>
            <h2 style={{ fontSize: isMobile ? '16px' : '20px', color: '#fbbf24', fontWeight: '800', marginTop: '2px' }}>密碼:{pwd}</h2>
          </div>
          <button onClick={handleCopyInfo} style={{ backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer' }}>📋</button>
        </div>

        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '4px' }}>
          {AVAILABLE_COLORS.map((color) => {
            const isTaken = Object.entries(allPlayers).some(([pKey, data]) => pKey !== playerKey && data.color === color.hex);
            const isMyColor = allPlayers[playerKey]?.color === color.hex;
            return (
              <button key={color.id} disabled={isTaken} onClick={() => handleColorSelect(color.hex)} style={{ width: '22px', height: '22px', borderRadius: '5px', border: isMyColor ? '2px solid white' : '1px solid transparent', backgroundColor: color.hex, opacity: isTaken ? 0.1 : 1 }} />
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {floors.map((floorIdx) => (
          <div key={floorIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '10px', borderRadius: '12px' }}>
            <div style={{ width: '45px', fontSize: '14px', fontWeight: '900', color: '#444', textAlign: 'center' }}>F{floorIdx + 1}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flex: 1 }}>
              {[0, 1, 2, 3].map((cellIdx) => {
                let occupantColor = null;
                let isMine = false;
                Object.entries(allPlayers).forEach(([pKey, data]) => {
                  if (data.choices?.[floorIdx] === cellIdx) {
                    occupantColor = data.color || '#4b5563';
                    if (pKey === playerKey) isMine = true;
                  }
                });
                const isTakenByOthers = occupantColor && !isMine;
                return (
                  <button
                    key={cellIdx}
                    onClick={() => handleSelect(floorIdx, cellIdx)}
                    style={{
                      height: '60px',
                      backgroundColor: occupantColor || '#222',
                      borderRadius: '10px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      outline: isMine ? '3px solid white' : 'none',
                      outlineOffset: '-3px',
                      opacity: isTakenByOthers ? 0.6 : 1,
                      cursor: isTakenByOthers ? 'not-allowed' : 'pointer'
                    }}>
                    {isMine ? 'YOU' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:roomId" element={<GameRoom />} />
      </Routes>
    </Router>
  );
}

export default App;