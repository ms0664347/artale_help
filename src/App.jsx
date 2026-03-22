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
      // 1. 自動清理超過 1 天的房間
      try {
        const allRoomsRef = ref(db, 'rooms');
        const allRoomsSnapshot = await get(allRoomsRef);
        if (allRoomsSnapshot.exists()) {
          const now = Date.now();
          const oneDayMs = 24 * 60 * 60 * 1000;
          const roomsData = allRoomsSnapshot.val();
          Object.keys(roomsData).forEach(async (id) => {
            if (roomsData[id].createdAt && (now - roomsData[id].createdAt > oneDayMs)) {
              await remove(ref(db, `rooms/${ id }`));
            }
          });
        }
      } catch (e) { console.error(e); }

      // 2. 創建新房間
      if (snapshot.exists()) {
        window.Swal.fire({ icon: 'error', title: '房號重複，請重試', background: '#1a1a1a', color: '#fff' });
      } else {
        await set(roomRef, { password: cleanPassword, players: {}, createdAt: Date.now() });
        navigate(`/game/${ cleanRoomId }?u=${ userUuid }&pwd=${ cleanPassword }`);
      }
    } else {
      // 加入房間
      if (!snapshot.exists() || snapshot.val().password !== cleanPassword) {
        window.Swal.fire({ icon: 'error', title: '房號或密碼錯誤', background: '#1a1a1a', color: '#fff' });
      } else {
        const players = snapshot.val().players || {};
        if (Object.keys(players).length >= 4) {
          window.Swal.fire({ icon: 'warning', title: '房間已滿', background: '#1a1a1a', color: '#fff' });
          return;
        }
        navigate(`/game/${ cleanRoomId }?u=${ userUuid }&pwd=${ cleanPassword }`);
      }
    }
  };

  const btnStyle = { padding: '15px 30px', fontSize: '18px', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', width: '100%', marginBottom: '10px' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' };

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '900', marginBottom: '20px' }}>Artale</h1>
        <h2 style={{ color: '#888', marginBottom: '40px', fontSize: '20px' }}>羅密歐與祝英台 Helper</h2>
        <h2 style={{ color: '#555', marginBottom: '30px', fontSize: '16px' }}>我打玩了，先關了，謝謝大家!</h2>
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
              <input placeholder="輸入 8 位數房號" style={inputStyle} value={form.roomId} onChange={e => setForm({ ...form, roomId: e.target.value })} />
            )}
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength="4" placeholder="請輸入 4 位數密碼" style={inputStyle} value={form.password} onChange={e => setForm({ ...form, password: e.target.value.replace(/\D/g, '') })} />
            <button onClick={handleAction} style={{ ...btnStyle, backgroundColor: '#fff', color: '#000', marginTop: '10px' }}>確定</button>
            <p onClick={() => setMode('menu')} style={{ color: '#666', cursor: 'pointer', marginTop: '15px' }}>返回主選單</p>
          </div>
        )}
        <div style={{ marginTop: '50px', color: '#828080', fontSize: '20px', letterSpacing: '1px' }}>made by 小豬萱萱</div>
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
  const playerCount = Object.keys(allPlayers).length;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!userUuid || !pwd) { navigate('/'); return; }

    const playerRef = ref(db, `rooms/${ roomId }/players/${ playerKey }`);
    const roomRef = ref(db, `rooms/${ roomId }`);

    // --- 【新增】進場即佔位邏輯 ---
    get(playerRef).then((snap) => {
      if (!snap.exists()) {
        update(playerRef, { joinedAt: Date.now() });
      }
    });

    return onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) { navigate('/'); return; }
      if (snapshot.val().password !== pwd) {
        window.Swal.fire({ icon: 'error', title: '驗證失敗', background: '#1a1a1a', color: '#fff' });
        navigate('/'); return;
      }
      setAllPlayers(snapshot.val().players || {});
    });
  }, [roomId, pwd, userUuid, playerKey, navigate]);

  const handleExitRoom = async () => {
    const roomPath = `rooms/${ roomId }`;
    try {
      const snap = await get(ref(db, `${ roomPath }/players`));
      const currentPlayers = snap.val() || {};
      if (Object.keys(currentPlayers).length <= 1) {
        await remove(ref(db, roomPath));
      } else {
        await remove(ref(db, `${ roomPath }/players/${ playerKey }`));
      }
    } catch (e) { console.error(e); }
    navigate('/');
  };

  const handleCopyInfo = () => {
    navigator.clipboard.writeText(`房間：${ roomId }\n密碼：${ pwd }`).then(() => {
      window.Swal.fire({ title: '已複製', icon: 'success', timer: 800, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    });
  };

  const handleColorSelect = (colorHex) => {
    update(ref(db, `rooms/${ roomId }/players/${ playerKey }`), { color: colorHex });
  };

  const handleClearAll = () => {
    window.Swal.fire({ title: '確定重置嗎？', text: '清除樓層但保留選擇顏色', icon: 'warning', showCancelButton: true, background: '#1a1a1a', color: '#fff' }).then((res) => {
      if (res.isConfirmed) {
        const updates = {};
        Object.keys(allPlayers).forEach(pKey => { updates[`rooms/${ roomId }/players/${ pKey }/choices`] = null; });
        update(ref(db), updates);
      }
    });
  };

  const handleSelect = (floorIdx, cellIdx) => {
    if (!allPlayers[playerKey]?.color) {
      window.Swal.fire({ icon: 'error', title: '請先選顏色！', background: '#1a1a1a', color: '#fff' });
      return;
    }
    const isTaken = Object.entries(allPlayers).some(([pKey, data]) => pKey !== playerKey && data.choices?.[floorIdx] === cellIdx);
    if (isTaken) {
      window.Swal.fire({ icon: 'warning', title: '這格有人囉', timer: 1000, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
      return;
    }
    const current = allPlayers[playerKey]?.choices?.[floorIdx];
    update(ref(db, `rooms/${ roomId }/players/${ playerKey }/choices`), { [floorIdx]: current === cellIdx ? null : cellIdx });
  };

  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - i - 1);

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', padding: '10px' }}>
      {/* 頂部欄 */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(0,0,0,0.98)', zIndex: 100, borderBottom: '2px solid #333', padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', height: '100px' }}>

        {/* 左側：返回、重置、人數 (設定寬度避免推擠) */}
        <div style={{
          width: isMobile ? '80px' : '150px', // 設定固定寬度
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '8px',
          flexShrink: 0 // 防止被中間擠壓
        }}>
          <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row' }}>
            <button onClick={handleExitRoom} style={{ backgroundColor: '#333', color: '#eee', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: isMobile ? '12px' : '20px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>返回大廳</button>
            <button onClick={handleClearAll} style={{ backgroundColor: '#1a1a1a', color: '#555', border: '1px solid #222', padding: '6px 8px', borderRadius: '6px', fontSize: isMobile ? '12px' : '20px', fontWeight: 'bold', whiteSpace: 'nowrap', zIndex: 1 }}>重置顏色</button>
          </div>
          {/* 人數標籤 */}
          <span style={{
            backgroundColor: '#333',
            padding: '4px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            border: '1px solid #555',
            whiteSpace: 'nowrap',
            color: '#fff'
          }}>
            👤 {playerCount}/4
          </span>
        </div>

        {/* 中間：房號與密碼 (絕對置中) */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '28px', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            房號:{roomId}
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: isMobile ? '13px' : '20px', color: '#fbbf24', margin: 0 }}>密碼:{pwd}</h2>
            <button onClick={handleCopyInfo} style={{ backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '12px' }}>📋</button>
          </div>
        </div>

        {/* 右側：顏色選擇 (設定與左側對等的寬度) */}
        <div style={{
          width: isMobile ? '70px' : '150px', // 手機版稍微放寬一點點確保文字不折行
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          flexShrink: 0
        }}>
          {/* 關鍵修正：必須判斷是否有 color 欄位 */}
          {(!allPlayers[playerKey] || !allPlayers[playerKey].color) ? (
            <div style={{
              fontSize: '16px',
              color: '#ffc533',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              marginBottom: '2px',
              animation: 'pulse 1.5s infinite ease-in-out'
            }}>
              請選擇顏色
            </div>
          ) : (
            // 選色後留一個等高的空白佔位，防止 Grid 向上彈跳
            <div style={{ height: '15px', marginBottom: '2px' }} />
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '4px',
            justifyItems: 'center'
          }}>
            {AVAILABLE_COLORS.map((c) => {
              const isTaken = Object.entries(allPlayers).some(([pKey, data]) => pKey !== playerKey && data.color === c.hex);
              const isMine = allPlayers[playerKey]?.color === c.hex;
              return (
                <button
                  key={c.id}
                  disabled={isTaken}
                  onClick={() => handleColorSelect(c.hex)}
                  style={{
                    width: isMobile ? '22px' : '26px',
                    height: isMobile ? '22px' : '26px',
                    borderRadius: '6px',
                    border: isMine ? '2px solid white' : '1px solid #333',
                    backgroundColor: c.hex,
                    opacity: isTaken ? 0.1 : 1,
                    cursor: isTaken ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                />
              );
            })}
          </div>

          {/* 如果你想要呼吸燈效果動起來，請在 App 的 CSS 或是組件上方補上這段 style */}
          <style>{`
    @keyframes pulse {
      0% { opacity: 0.5; }
      50% { opacity: 1; }
      100% { opacity: 0.5; }
    }
  `}</style>
        </div>
      </div>

      {/* 樓層列表 */}
      <div style={{ maxWidth: '540px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {floors.map((fIdx) => (
          <div key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '9px', backgroundColor: '#111', padding: '9px', borderRadius: '11px' }}>
            <div style={{ width: '40px', fontSize: '13px', fontWeight: '900', color: '#444', textAlign: 'center' }}>F{fIdx + 1}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', flex: 1 }}>
              {[0, 1, 2, 3].map((cIdx) => {
                let occColor = null; let isMine = false;
                Object.entries(allPlayers).forEach(([pKey, data]) => {
                  if (data.choices?.[fIdx] === cIdx) { occColor = data.color || '#4b5563'; if (pKey === playerKey) isMine = true; }
                });
                return (
                  <button key={cIdx} onClick={() => handleSelect(fIdx, cIdx)} style={{ height: '54px', backgroundColor: occColor || '#222', borderRadius: '9px', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 'bold', outline: isMine ? '3px solid white' : 'none', outlineOffset: '-3px', opacity: occColor && !isMine ? 0.6 : 1 }}>
                    {isMine ? 'YOU' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '20px', color: '#444', fontSize: '14px' }}>made by 小豬萱萱</div>
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