import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
const {
  useState,
  useEffect,
  useRef
} = React;
const TASK_COLORS = [{
  name: 'Терракота',
  hex: '#E2570F'
}, {
  name: 'Бирюза',
  hex: '#1B9E82'
}, {
  name: 'Слива',
  hex: '#95479A'
}, {
  name: 'Охра',
  hex: '#E2A324'
}, {
  name: 'Индиго',
  hex: '#4569E0'
}, {
  name: 'Кирпич',
  hex: '#C4453F'
}, {
  name: 'Хвоя',
  hex: '#4A9E3E'
}, {
  name: 'Олива',
  hex: '#9C9631'
}];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function toKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function formatShort(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}
function countDaysBetween(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.round((e - s) / 86400000) + 1;
}
function getMonthGrid(y, m) {
  const firstDayIdx = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

// Документ целиком: задачи + дела + время последнего изменения.
// Ключи localStorage те же, что и раньше, — старые данные подхватятся.
function loadDoc() {
  const tasks = loadLocal('planner-tasks', []);
  const events = loadLocal('planner-events', []);
  let updatedAt = loadLocal('planner-updated', 0);
  if (!updatedAt && (tasks.length || events.length)) {
    updatedAt = Date.now();
    saveLocal('planner-updated', updatedAt);
  }
  return {
    tasks,
    events,
    updatedAt
  };
}
const CFG = window.PLANNER_CONFIG || {};
const sb = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
function translateAuthError(msg) {
  if (!msg) return '';
  if (/invalid login credentials/i.test(msg)) return 'Неверная почта или пароль';
  if (/already registered/i.test(msg)) return 'Такой аккаунт уже есть — нажмите «Войти»';
  if (/at least 6/i.test(msg)) return 'Пароль — минимум 6 символов';
  if (/valid email|invalid email/i.test(msg)) return 'Проверьте адрес почты';
  if (/email not confirmed/i.test(msg)) return 'Почта не подтверждена — проверьте письмо';
  return msg;
}
const INK = '#241F18';
const MUTED = '#8B8272';
const ACCENT = '#2F6F62';
const PAGE_BG = '#E8E4D8';
const CARD_BG = '#FBFAF6';
const BORDER = '#D7D0BE';
function App() {
  const now = new Date();
  const [view, setView] = useState({
    y: now.getFullYear(),
    m: now.getMonth()
  });
  const [doc, setDoc] = useState(loadDoc);
  const docRef = useRef(doc);
  docRef.current = doc;
  const tasks = doc.tasks;
  const events = doc.events;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [planningTaskId, setPlanningTaskId] = useState(null);
  const [taskDraft, setTaskDraft] = useState({
    name: '',
    start: '',
    end: '',
    color: TASK_COLORS[0].hex
  });
  const [eventDraft, setEventDraft] = useState({
    name: '',
    date: '',
    color: TASK_COLORS[0].hex
  });
  const [taskErr, setTaskErr] = useState('');
  const [eventErr, setEventErr] = useState('');

  // ---- синхронизация ----
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!sb);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [authDraft, setAuthDraft] = useState({
    email: '',
    password: ''
  });
  const [authBusy, setAuthBusy] = useState(false);
  const lastPushed = useRef(0);
  const pushTimer = useRef(null);
  const syncing = useRef(false);
  const pullRef = useRef(null);
  function updateDoc(fn) {
    setDoc(prev => ({
      ...fn(prev),
      updatedAt: Date.now()
    }));
  }
  function setTasks(fn) {
    updateDoc(d => ({
      ...d,
      tasks: fn(d.tasks)
    }));
  }
  function setEvents(fn) {
    updateDoc(d => ({
      ...d,
      events: fn(d.events)
    }));
  }
  useEffect(() => {
    saveLocal('planner-tasks', doc.tasks);
    saveLocal('planner-events', doc.events);
    saveLocal('planner-updated', doc.updatedAt);
  }, [doc]);
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({
      data
    }) => {
      setUser(data.session ? data.session.user : null);
      setAuthReady(true);
    });
    const {
      data: sub
    } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  async function pushDoc(d) {
    const {
      error
    } = await sb.from('planner_data').upsert({
      user_id: user.id,
      doc: d,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    lastPushed.current = d.updatedAt;
  }
  async function pull() {
    if (!sb || !user || syncing.current) return;
    syncing.current = true;
    setSyncStatus('syncing');
    try {
      const {
        data,
        error
      } = await sb.from('planner_data').select('doc').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      const remote = data && data.doc;
      const remoteTs = remote && remote.updatedAt ? remote.updatedAt : 0;
      const local = docRef.current;
      if (remote && remoteTs > local.updatedAt) {
        lastPushed.current = remoteTs;
        setDoc({
          tasks: remote.tasks || [],
          events: remote.events || [],
          updatedAt: remoteTs
        });
      } else if (local.updatedAt > remoteTs) {
        await pushDoc(local);
      } else {
        lastPushed.current = local.updatedAt;
      }
      setSyncStatus('idle');
      setSyncMsg('');
    } catch (e) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
      setSyncMsg(e && e.message ? e.message : '');
    } finally {
      syncing.current = false;
    }
  }
  pullRef.current = pull;

  // забираем данные при входе, при возврате в приложение и раз в минуту
  useEffect(() => {
    if (!sb || !user) return;
    pullRef.current();
    const onWake = () => {
      if (document.visibilityState === 'visible') pullRef.current();
    };
    const onOnline = () => pullRef.current();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onOnline);
    const iv = setInterval(onWake, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
    };
  }, [user && user.id]);

  // отправляем изменения с небольшой задержкой
  useEffect(() => {
    if (!sb || !user) return;
    if (doc.updatedAt <= lastPushed.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await pushDoc(docRef.current);
        setSyncStatus('idle');
        setSyncMsg('');
      } catch (e) {
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        setSyncMsg(e && e.message ? e.message : '');
      }
    }, 800);
    return () => clearTimeout(pushTimer.current);
  }, [doc.updatedAt, user]);
  async function signIn() {
    setAuthBusy(true);
    setSyncMsg('');
    const {
      error
    } = await sb.auth.signInWithPassword({
      email: authDraft.email.trim(),
      password: authDraft.password
    });
    if (error) setSyncMsg(translateAuthError(error.message));
    setAuthBusy(false);
  }
  async function signUp() {
    setAuthBusy(true);
    setSyncMsg('');
    const {
      data,
      error
    } = await sb.auth.signUp({
      email: authDraft.email.trim(),
      password: authDraft.password
    });
    if (error) setSyncMsg(translateAuthError(error.message));else if (!data.session) setSyncMsg('Аккаунт создан. Подтвердите почту по письму и затем нажмите «Войти».');
    setAuthBusy(false);
  }
  async function signOut() {
    await sb.auth.signOut();
    setSyncMsg('');
    setSyncStatus('idle');
  }
  const grid = getMonthGrid(view.y, view.m);
  const today = todayKey();
  function changeMonth(delta) {
    let m = view.m + delta,
      y = view.y;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setView({
      y,
      m
    });
  }
  function openEventFormForDate(dateKey) {
    setEventDraft({
      name: '',
      date: dateKey,
      color: TASK_COLORS[0].hex
    });
    setEventErr('');
    setShowEventForm(true);
  }
  function handleCellClick(dateKey) {
    if (planningTaskId) {
      const task = tasks.find(t => t.id === planningTaskId);
      if (!task) return;
      if (dateKey < task.start || dateKey > task.end) return;
      setTasks(prev => prev.map(t => {
        if (t.id !== planningTaskId) return t;
        const has = t.plannedDays.includes(dateKey);
        return {
          ...t,
          plannedDays: has ? t.plannedDays.filter(d => d !== dateKey) : [...t.plannedDays, dateKey]
        };
      }));
    } else {
      openEventFormForDate(dateKey);
    }
  }
  function submitTask() {
    if (!taskDraft.name.trim()) {
      setTaskErr('Введите название задачи');
      return;
    }
    if (!taskDraft.start || !taskDraft.end) {
      setTaskErr('Укажите начало и дедлайн');
      return;
    }
    if (taskDraft.end < taskDraft.start) {
      setTaskErr('Дедлайн раньше начала');
      return;
    }
    setTasks(prev => [...prev, {
      id: uid(),
      name: taskDraft.name.trim(),
      start: taskDraft.start,
      end: taskDraft.end,
      color: taskDraft.color,
      plannedDays: []
    }]);
    setTaskDraft({
      name: '',
      start: '',
      end: '',
      color: TASK_COLORS[(tasks.length + 1) % TASK_COLORS.length].hex
    });
    setTaskErr('');
    setShowTaskForm(false);
  }
  function submitEvent() {
    if (!eventDraft.name.trim()) {
      setEventErr('Введите название дела');
      return;
    }
    if (!eventDraft.date) {
      setEventErr('Укажите дату');
      return;
    }
    setEvents(prev => [...prev, {
      id: uid(),
      name: eventDraft.name.trim(),
      date: eventDraft.date,
      color: eventDraft.color
    }]);
    setEventErr('');
    setShowEventForm(false);
  }
  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (planningTaskId === id) setPlanningTaskId(null);
  }
  function deleteEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }
  const planningTask = tasks.find(t => t.id === planningTaskId);
  const statusLabel = syncStatus === 'syncing' ? 'Синхронизация…' : syncStatus === 'offline' ? 'Нет сети — сохранено на устройстве' : syncStatus === 'error' ? 'Ошибка синхронизации' : 'Всё синхронизировано';
  return /*#__PURE__*/_jsxDEV("div", {
    style: {
      background: PAGE_BG,
      color: INK,
      minHeight: '100vh',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    },
    className: "p-4 sm:p-8",
    children: [/*#__PURE__*/_jsxDEV("div", {
      className: "max-w-6xl mx-auto flex flex-col lg:flex-row gap-6",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "flex-1 min-w-0",
        children: /*#__PURE__*/_jsxDEV("div", {
          style: {
            background: CARD_BG,
            border: `1px solid ${BORDER}`
          },
          className: "rounded-lg p-3 sm:p-6",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "flex items-center justify-between mb-5",
            children: [/*#__PURE__*/_jsxDEV("button", {
              onClick: () => changeMonth(-1),
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "px-3 py-1.5 rounded-md hover:opacity-70 transition text-lg",
              children: "‹"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h1", {
              style: {
                fontFamily: 'Georgia, serif'
              },
              className: "text-xl sm:text-2xl font-semibold tracking-wide",
              children: [MONTHS[view.m], " ", view.y]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              onClick: () => changeMonth(1),
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "px-3 py-1.5 rounded-md hover:opacity-70 transition text-lg",
              children: "›"
            }, void 0, false)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "grid grid-cols-7 gap-1 mb-1",
            children: WEEKDAYS.map(w => /*#__PURE__*/_jsxDEV("div", {
              style: {
                color: MUTED
              },
              className: "text-center text-xs font-medium py-1",
              children: w
            }, w, false))
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "grid grid-cols-7 gap-1",
            children: grid.map((d, i) => {
              if (d === null) return /*#__PURE__*/_jsxDEV("div", {
                className: "h-20 sm:h-24 rounded-md",
                style: {
                  background: 'transparent'
                }
              }, i, false);
              const dateKey = toKey(view.y, view.m, d);
              const tasksInRange = tasks.filter(t => dateKey >= t.start && dateKey <= t.end);
              const plannedToday = tasksInRange.filter(t => t.plannedDays.includes(dateKey));
              const eventsToday = events.filter(e => e.date === dateKey);
              const isToday = dateKey === today;
              const isPlannableHere = planningTask && dateKey >= planningTask.start && dateKey <= planningTask.end;
              const ringShadows = tasksInRange.slice(0, 3).map((t, idx) => `inset 0 0 0 ${3 + idx * 4}px ${t.color}`);
              let background = 'transparent';
              if (plannedToday.length === 1) {
                background = plannedToday[0].color;
              } else if (plannedToday.length > 1) {
                const n = plannedToday.length;
                const stops = plannedToday.map((t, idx) => `${t.color} ${(idx * 100 / n).toFixed(1)}%, ${t.color} ${((idx + 1) * 100 / n).toFixed(1)}%`).join(', ');
                background = `linear-gradient(135deg, ${stops})`;
              }
              const filled = plannedToday.length > 0;
              return /*#__PURE__*/_jsxDEV("div", {
                onClick: () => handleCellClick(dateKey),
                style: {
                  background,
                  boxShadow: ringShadows.length ? ringShadows.join(', ') : isToday ? `inset 0 0 0 2px ${ACCENT}` : `inset 0 0 0 1px ${BORDER}`,
                  cursor: planningTask ? isPlannableHere ? 'pointer' : 'default' : 'pointer',
                  opacity: planningTask && !isPlannableHere ? 0.45 : 1
                },
                className: "h-20 sm:h-24 rounded-md p-1.5 flex flex-col justify-between overflow-hidden relative",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  style: {
                    color: filled ? '#fff' : isToday ? ACCENT : INK,
                    fontWeight: isToday ? 700 : 500
                  },
                  className: "text-xs sm:text-sm leading-none",
                  children: d
                }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                  className: "flex flex-col gap-0.5 mt-auto",
                  children: [eventsToday.slice(0, 2).map(e => /*#__PURE__*/_jsxDEV("span", {
                    title: e.name,
                    style: {
                      background: e.color,
                      color: '#fff'
                    },
                    className: "text-[10px] leading-tight rounded px-1 py-0.5 truncate",
                    children: e.name
                  }, e.id, false)), eventsToday.length > 2 && /*#__PURE__*/_jsxDEV("span", {
                    style: {
                      color: filled ? '#fff' : MUTED
                    },
                    className: "text-[10px]",
                    children: ["+", eventsToday.length - 2]
                  }, void 0, true)]
                }, void 0, true)]
              }, i, true);
            })
          }, void 0, false), planningTask && /*#__PURE__*/_jsxDEV("div", {
            style: {
              background: '#F1EEE2',
              border: `1px solid ${BORDER}`
            },
            className: "mt-4 rounded-md p-3 flex items-center justify-between gap-3 flex-wrap",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "flex items-center gap-2 text-sm",
              children: [/*#__PURE__*/_jsxDEV("span", {
                style: {
                  background: planningTask.color
                },
                className: "w-2.5 h-2.5 rounded-full inline-block"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                children: ["Режим планирования: ", /*#__PURE__*/_jsxDEV("b", {
                  children: planningTask.name
                }, void 0, false), ". Кликайте по дням внутри рамки, чтобы отметить их полной заливкой."]
              }, void 0, true)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              onClick: () => setPlanningTaskId(null),
              style: {
                background: ACCENT,
                color: '#fff'
              },
              className: "text-sm px-3 py-1.5 rounded-md shrink-0",
              children: "✓ Готово"
            }, void 0, false)]
          }, void 0, true), !planningTask && /*#__PURE__*/_jsxDEV("p", {
            style: {
              color: MUTED
            },
            className: "text-xs mt-4",
            children: "Клик по дню создаёт разовое дело на эту дату. Чтобы распланировать дни задачи — нажмите «Планировать» у нужной задачи."
          }, void 0, false)]
        }, void 0, true)
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "w-full lg:w-80 shrink-0 flex flex-col gap-4",
        children: [/*#__PURE__*/_jsxDEV("div", {
          style: {
            background: CARD_BG,
            border: `1px solid ${BORDER}`
          },
          className: "rounded-lg p-4",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "flex items-center justify-between mb-3",
            children: [/*#__PURE__*/_jsxDEV("h2", {
              className: "text-sm font-semibold",
              children: "▤ Задачи"
            }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
              onClick: () => {
                setTaskDraft({
                  name: '',
                  start: today,
                  end: today,
                  color: TASK_COLORS[tasks.length % TASK_COLORS.length].hex
                });
                setTaskErr('');
                setShowTaskForm(true);
              },
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-8 h-8 rounded-md hover:opacity-70 flex items-center justify-center",
              children: "+"
            }, void 0, false)]
          }, void 0, true), tasks.length === 0 && /*#__PURE__*/_jsxDEV("p", {
            style: {
              color: MUTED
            },
            className: "text-xs",
            children: "Пока нет ни одной задачи."
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "flex flex-col gap-2",
            children: tasks.map(t => {
              const total = countDaysBetween(t.start, t.end);
              const planned = t.plannedDays.length;
              const isPlanning = planningTaskId === t.id;
              return /*#__PURE__*/_jsxDEV("div", {
                style: {
                  border: `1px solid ${BORDER}`,
                  background: isPlanning ? '#F1EEE2' : 'transparent'
                },
                className: "rounded-md p-2.5",
                children: [/*#__PURE__*/_jsxDEV("div", {
                  className: "flex items-start justify-between gap-2",
                  children: [/*#__PURE__*/_jsxDEV("div", {
                    className: "flex items-start gap-2 min-w-0",
                    children: [/*#__PURE__*/_jsxDEV("span", {
                      style: {
                        background: t.color
                      },
                      className: "w-2.5 h-2.5 rounded-full inline-block mt-1 shrink-0"
                    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                      className: "min-w-0",
                      children: [/*#__PURE__*/_jsxDEV("p", {
                        className: "text-sm font-medium truncate",
                        children: t.name
                      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
                        style: {
                          color: MUTED
                        },
                        className: "text-xs",
                        children: [formatShort(t.start), " – ", formatShort(t.end)]
                      }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                        style: {
                          color: MUTED
                        },
                        className: "text-xs",
                        children: [planned, " / ", total, " дн. запланировано"]
                      }, void 0, true)]
                    }, void 0, true)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                    onClick: () => deleteTask(t.id),
                    className: "shrink-0 p-1 hover:opacity-60",
                    "aria-label": "Удалить задачу",
                    children: "✕"
                  }, void 0, false)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  onClick: () => setPlanningTaskId(isPlanning ? null : t.id),
                  style: {
                    background: isPlanning ? ACCENT : 'transparent',
                    color: isPlanning ? '#fff' : INK,
                    border: `1px solid ${isPlanning ? ACCENT : BORDER}`
                  },
                  className: "w-full mt-2 text-xs py-2 rounded-md",
                  children: isPlanning ? 'Готово' : 'Планировать дни'
                }, void 0, false)]
              }, t.id, true);
            })
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          style: {
            background: CARD_BG,
            border: `1px solid ${BORDER}`
          },
          className: "rounded-lg p-4",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "flex items-center justify-between mb-3",
            children: [/*#__PURE__*/_jsxDEV("h2", {
              className: "text-sm font-semibold",
              children: "◆ Разовые дела"
            }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
              onClick: () => openEventFormForDate(today),
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-8 h-8 rounded-md hover:opacity-70 flex items-center justify-center",
              children: "+"
            }, void 0, false)]
          }, void 0, true), events.length === 0 && /*#__PURE__*/_jsxDEV("p", {
            style: {
              color: MUTED
            },
            className: "text-xs",
            children: "Пока нет разовых дел."
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "flex flex-col gap-1.5 max-h-60 overflow-y-auto",
            children: [...events].sort((a, b) => a.date.localeCompare(b.date)).map(e => /*#__PURE__*/_jsxDEV("div", {
              className: "flex items-center justify-between gap-2 text-sm",
              children: [/*#__PURE__*/_jsxDEV("div", {
                className: "flex items-center gap-2 min-w-0",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  style: {
                    background: e.color
                  },
                  className: "w-2 h-2 rounded-full inline-block shrink-0"
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: "truncate",
                  children: e.name
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  style: {
                    color: MUTED
                  },
                  className: "text-xs shrink-0",
                  children: formatShort(e.date)
                }, void 0, false)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                onClick: () => deleteEvent(e.id),
                className: "shrink-0 p-1 hover:opacity-60",
                "aria-label": "Удалить дело",
                children: "✕"
              }, void 0, false)]
            }, e.id, true))
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          style: {
            background: CARD_BG,
            border: `1px solid ${BORDER}`
          },
          className: "rounded-lg p-4",
          children: [/*#__PURE__*/_jsxDEV("h2", {
            className: "text-sm font-semibold mb-3",
            children: "☁ Синхронизация"
          }, void 0, false), !sb && /*#__PURE__*/_jsxDEV("p", {
            style: {
              color: MUTED
            },
            className: "text-xs",
            children: "Не настроена: впишите данные Supabase в файл config.js. Пока данные хранятся только на этом устройстве."
          }, void 0, false), sb && !authReady && /*#__PURE__*/_jsxDEV("p", {
            style: {
              color: MUTED
            },
            className: "text-xs",
            children: "Загрузка…"
          }, void 0, false), sb && authReady && !user && /*#__PURE__*/_jsxDEV("form", {
            onSubmit: e => {
              e.preventDefault();
              signIn();
            },
            children: [/*#__PURE__*/_jsxDEV("input", {
              type: "email",
              autoComplete: "email",
              value: authDraft.email,
              onChange: e => setAuthDraft({
                ...authDraft,
                email: e.target.value
              }),
              placeholder: "Почта",
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-full mb-2 px-2.5 py-2 rounded-md text-sm outline-none bg-transparent"
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "password",
              autoComplete: "current-password",
              value: authDraft.password,
              onChange: e => setAuthDraft({
                ...authDraft,
                password: e.target.value
              }),
              placeholder: "Пароль",
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-full mb-3 px-2.5 py-2 rounded-md text-sm outline-none bg-transparent"
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "flex gap-2",
              children: [/*#__PURE__*/_jsxDEV("button", {
                type: "submit",
                disabled: authBusy,
                style: {
                  background: ACCENT,
                  color: '#fff'
                },
                className: "flex-1 py-2 rounded-md text-sm font-medium",
                children: "Войти"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                type: "button",
                disabled: authBusy,
                onClick: signUp,
                style: {
                  border: `1px solid ${BORDER}`
                },
                className: "flex-1 py-2 rounded-md text-sm",
                children: "Создать"
              }, void 0, false)]
            }, void 0, true), syncMsg && /*#__PURE__*/_jsxDEV("p", {
              style: {
                color: '#A32D2D'
              },
              className: "text-xs mt-3",
              children: syncMsg
            }, void 0, false)]
          }, void 0, true), sb && authReady && user && /*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-sm truncate",
              children: user.email
            }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
              style: {
                color: syncStatus === 'error' ? '#A32D2D' : MUTED
              },
              className: "text-xs mt-1",
              children: statusLabel
            }, void 0, false), syncStatus === 'error' && syncMsg && /*#__PURE__*/_jsxDEV("p", {
              style: {
                color: '#A32D2D'
              },
              className: "text-xs mt-1 break-words",
              children: syncMsg
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "flex gap-2 mt-3",
              children: [/*#__PURE__*/_jsxDEV("button", {
                onClick: () => pull(),
                style: {
                  border: `1px solid ${BORDER}`
                },
                className: "flex-1 py-2 rounded-md text-xs",
                children: "Обновить"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                onClick: signOut,
                style: {
                  border: `1px solid ${BORDER}`
                },
                className: "flex-1 py-2 rounded-md text-xs",
                children: "Выйти"
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
          style: {
            color: MUTED
          },
          className: "text-xs text-center",
          children: user ? 'Данные хранятся на устройстве и в облаке.' : 'Данные хранятся локально на этом устройстве.'
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true), showTaskForm && /*#__PURE__*/_jsxDEV("div", {
      className: "fixed inset-0 flex items-center justify-center p-4 z-50",
      style: {
        background: 'rgba(36,31,24,0.45)'
      },
      onClick: () => setShowTaskForm(false),
      children: /*#__PURE__*/_jsxDEV("div", {
        style: {
          background: CARD_BG
        },
        onClick: e => e.stopPropagation(),
        className: "rounded-lg p-5 w-full max-w-sm",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "flex items-center justify-between mb-4",
          children: [/*#__PURE__*/_jsxDEV("h3", {
            className: "font-semibold",
            children: "Новая задача"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            onClick: () => setShowTaskForm(false),
            className: "p-1",
            children: "✕"
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("label", {
          className: "text-xs",
          style: {
            color: MUTED
          },
          children: "Название"
        }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
          value: taskDraft.name,
          onChange: e => setTaskDraft({
            ...taskDraft,
            name: e.target.value
          }),
          placeholder: "Например, пошив партии сумок",
          style: {
            border: `1px solid ${BORDER}`
          },
          className: "w-full mt-1 mb-3 px-2.5 py-2 rounded-md text-sm outline-none bg-transparent"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "flex gap-2 mb-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "flex-1 min-w-0",
            children: [/*#__PURE__*/_jsxDEV("label", {
              className: "text-xs",
              style: {
                color: MUTED
              },
              children: "Начало"
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "date",
              value: taskDraft.start,
              onChange: e => setTaskDraft({
                ...taskDraft,
                start: e.target.value
              }),
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-full mt-1 px-2 py-2 rounded-md text-sm outline-none bg-transparent"
            }, void 0, false)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "flex-1 min-w-0",
            children: [/*#__PURE__*/_jsxDEV("label", {
              className: "text-xs",
              style: {
                color: MUTED
              },
              children: "Дедлайн"
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "date",
              value: taskDraft.end,
              onChange: e => setTaskDraft({
                ...taskDraft,
                end: e.target.value
              }),
              style: {
                border: `1px solid ${BORDER}`
              },
              className: "w-full mt-1 px-2 py-2 rounded-md text-sm outline-none bg-transparent"
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("label", {
          className: "text-xs",
          style: {
            color: MUTED
          },
          children: "Цвет"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "flex flex-wrap gap-2 mt-1 mb-4",
          children: TASK_COLORS.map(c => /*#__PURE__*/_jsxDEV("button", {
            title: c.name,
            onClick: () => setTaskDraft({
              ...taskDraft,
              color: c.hex
            }),
            style: {
              background: c.hex,
              boxShadow: taskDraft.color === c.hex ? `0 0 0 2px ${CARD_BG}, 0 0 0 4px ${c.hex}` : 'none'
            },
            className: "w-7 h-7 rounded-full"
          }, c.hex, false))
        }, void 0, false), taskErr && /*#__PURE__*/_jsxDEV("p", {
          style: {
            color: '#A32D2D'
          },
          className: "text-xs mb-3",
          children: taskErr
        }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
          onClick: submitTask,
          style: {
            background: ACCENT,
            color: '#fff'
          },
          className: "w-full py-2.5 rounded-md text-sm font-medium",
          children: "Добавить задачу"
        }, void 0, false)]
      }, void 0, true)
    }, void 0, false), showEventForm && /*#__PURE__*/_jsxDEV("div", {
      className: "fixed inset-0 flex items-center justify-center p-4 z-50",
      style: {
        background: 'rgba(36,31,24,0.45)'
      },
      onClick: () => setShowEventForm(false),
      children: /*#__PURE__*/_jsxDEV("div", {
        style: {
          background: CARD_BG
        },
        onClick: e => e.stopPropagation(),
        className: "rounded-lg p-5 w-full max-w-sm",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "flex items-center justify-between mb-4",
          children: [/*#__PURE__*/_jsxDEV("h3", {
            className: "font-semibold",
            children: "Разовое дело"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            onClick: () => setShowEventForm(false),
            className: "p-1",
            children: "✕"
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("label", {
          className: "text-xs",
          style: {
            color: MUTED
          },
          children: "Название"
        }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
          value: eventDraft.name,
          onChange: e => setEventDraft({
            ...eventDraft,
            name: e.target.value
          }),
          placeholder: "Например, встреча с клиентом",
          style: {
            border: `1px solid ${BORDER}`
          },
          className: "w-full mt-1 mb-3 px-2.5 py-2 rounded-md text-sm outline-none bg-transparent"
        }, void 0, false), /*#__PURE__*/_jsxDEV("label", {
          className: "text-xs",
          style: {
            color: MUTED
          },
          children: "Дата"
        }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
          type: "date",
          value: eventDraft.date,
          onChange: e => setEventDraft({
            ...eventDraft,
            date: e.target.value
          }),
          style: {
            border: `1px solid ${BORDER}`
          },
          className: "w-full mt-1 mb-3 px-2 py-2 rounded-md text-sm outline-none bg-transparent"
        }, void 0, false), /*#__PURE__*/_jsxDEV("label", {
          className: "text-xs",
          style: {
            color: MUTED
          },
          children: "Цвет"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "flex flex-wrap gap-2 mt-1 mb-4",
          children: TASK_COLORS.map(c => /*#__PURE__*/_jsxDEV("button", {
            title: c.name,
            onClick: () => setEventDraft({
              ...eventDraft,
              color: c.hex
            }),
            style: {
              background: c.hex,
              boxShadow: eventDraft.color === c.hex ? `0 0 0 2px ${CARD_BG}, 0 0 0 4px ${c.hex}` : 'none'
            },
            className: "w-7 h-7 rounded-full"
          }, c.hex, false))
        }, void 0, false), eventErr && /*#__PURE__*/_jsxDEV("p", {
          style: {
            color: '#A32D2D'
          },
          className: "text-xs mb-3",
          children: eventErr
        }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
          onClick: submitEvent,
          style: {
            background: ACCENT,
            color: '#fff'
          },
          className: "w-full py-2.5 rounded-md text-sm font-medium",
          children: "Добавить дело"
        }, void 0, false)]
      }, void 0, true)
    }, void 0, false)]
  }, void 0, true);
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/_jsxDEV(App, {}, void 0, false));
