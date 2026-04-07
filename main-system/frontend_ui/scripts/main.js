   const {useState,useEffect,useRef,useCallback,useMemo,createContext,useContext} = React;

    const MEALS = [
      {id:1,name:'Ugali na Mchuzi wa Nyama',desc:'Maize meal with beef stew & greens',price:4500,emoji:'🍛',badge:'popular',cat:'lunch',stock:true,calories:620},
      {id:2,name:'Wali na Maharagwe',desc:'Rice with red beans in coconut sauce',price:3500,emoji:'🍚',badge:'',cat:'lunch',stock:true,calories:480},
      {id:3,name:'Chips Mayai',desc:'Fried potato omelette, kachumbari salad',price:3000,emoji:'🥚',badge:'popular',cat:'lunch',stock:true,calories:540},
      {id:4,name:'Mandazi & Chai',desc:'Deep fried dough with spiced milk tea',price:1500,emoji:'🫖',badge:'',cat:'breakfast',stock:true,calories:310},
      {id:5,name:'Mkate wa Kusukuma',desc:'Stir-fried greens on wheat flatbread',price:2500,emoji:'🥬',badge:'new',cat:'breakfast',stock:true,calories:280},
      {id:6,name:'Pilau ya Kuku',desc:'Spiced rice with chicken & whole spices',price:6000,emoji:'🍗',badge:'popular',cat:'dinner',stock:true,calories:710},
      {id:7,name:'Samosa (3 pcs)',desc:'Crispy pastry, minced meat & onion',price:2000,emoji:'🥟',badge:'',cat:'snacks',stock:true,calories:360},
      {id:8,name:'Maandazi (4 pcs)',desc:'Sweet fried pastry, plain or coconut',price:1000,emoji:'🍩',badge:'',cat:'snacks',stock:true,calories:290},
      {id:9,name:'Wali na Kuku Kienyeji',desc:'Local chicken with fragrant rice',price:7500,emoji:'🍗',badge:'',cat:'dinner',stock:false,calories:780},
      {id:10,name:'Uji wa Wimbi',desc:'Fermented finger millet porridge',price:1000,emoji:'🥣',badge:'',cat:'breakfast',stock:true,calories:180},
      {id:11,name:'Chapati na Maharage',desc:'Layered flatbread with beans',price:2500,emoji:'🫓',badge:'',cat:'breakfast',stock:true,calories:420},
      {id:12,name:'Biryani ya Ngombe',desc:'Slow-cooked beef biryani, raita side',price:7000,emoji:'🍲',badge:'new',cat:'dinner',stock:true,calories:820},
      {id:13,name:'Vitumbua (5 pcs)',desc:'Coconut rice pancakes, sweet',price:1500,emoji:'🥞',badge:'',cat:'snacks',stock:true,calories:340},
      {id:14,name:'Kuku Paka',desc:'Chicken in coconut curry, rice',price:7000,emoji:'🍛',badge:'popular',cat:'dinner',stock:true,calories:750},
      {id:15,name:'Supu ya Ndizi',desc:'Plantain & beef broth soup',price:3500,emoji:'🍌',badge:'new',cat:'lunch',stock:true,calories:310},
      {id:16,name:'Kande',desc:'Mixed maize & bean stew, traditional',price:2500,emoji:'🫘',badge:'',cat:'lunch',stock:true,calories:390},
      {id:17,name:'Bagia & Sauce',desc:'Split pea fritters with tamarind dip',price:1800,emoji:'🧆',badge:'',cat:'snacks',stock:true,calories:270},
      {id:18,name:'Makande ya Nazi',desc:'Maize & beans in coconut milk',price:3000,emoji:'🥥',badge:'',cat:'lunch',stock:true,calories:430},
    ];

    const DRINKS = [
      {id:101,name:'Tangawizi',desc:'Fresh ginger juice',price:1000,emoji:'🧃',cat:'drinks'},
      {id:102,name:'Maziwa',desc:'Fresh whole milk',price:800,emoji:'🥛',cat:'drinks'},
      {id:103,name:'Chai ya Maziwa',desc:'Spiced milk tea',price:700,emoji:'☕',cat:'drinks'},
      {id:104,name:'Madafu',desc:'Fresh coconut water',price:1500,emoji:'🥥',cat:'drinks'},
      {id:105,name:'Juice ya Embe',desc:'Fresh mango juice',price:1200,emoji:'🥭',cat:'drinks'},
      {id:106,name:'Maji Baridi',desc:'Cold mineral water',price:500,emoji:'💧',cat:'drinks'},
    ];

    const ALL_ITEMS = [...MEALS, ...DRINKS];

    const CATS = [
      {key:'all',label:'All'},
      {key:'breakfast',label:'Breakfast'},
      {key:'lunch',label:'Lunch'},
      {key:'dinner',label:'Dinner'},
      {key:'snacks',label:'Snacks'},
      {key:'drinks',label:'Drinks'},
    ];

    const CAT_COLORS = {
      breakfast:'#FFF5DC',lunch:'#E8F0E2',dinner:'#F5E8DC',
      snacks:'#EFE8F5',drinks:'#DCF0F5',all:'#EDE8DF'
    };

    const SAMPLE_ORDERS = [
      {id:'UNI-AB3X7K',student:'John Mwangi',reg:'CS/2022/042',items:[{name:'Ugali na Mchuzi',qty:1,price:4500},{name:'Tangawizi',qty:1,price:1000}],total:5627,paid:'mpesa',time:'08:32',status:'pending'},
      {id:'UNI-CD9Y2M',student:'Amina Hassan',reg:'ENG/2023/011',items:[{name:'Pilau ya Kuku',qty:2,price:12000},{name:'Madafu',qty:2,price:3000}],total:15300,paid:'tigo',time:'08:41',status:'pending'},
      {id:'UNI-EF5Z3N',student:'Peter Kimaro',reg:'LAW/2021/088',items:[{name:'Chips Mayai',qty:1,price:3000}],total:3060,paid:'mpesa',time:'08:55',status:'served'},
      {id:'UNI-GH7W4P',student:'Fatuma Said',reg:'MED/2022/034',items:[{name:'Chapati na Maharage',qty:2,price:5000},{name:'Chai ya Maziwa',qty:2,price:1400}],total:6528,paid:'halo',time:'09:02',status:'served'},
      {id:'UNI-IJ2V5Q',student:'Guest User',reg:'—',items:[{name:'Samosa (3 pcs)',qty:2,price:4000},{name:'Maziwa',qty:1,price:800}],total:4896,paid:'mpesa',time:'09:18',status:'pending'},
    ];

    const SALES_DATA = [
      {day:'Mon',sales:87400},{day:'Tue',sales:102300},{day:'Wed',sales:94700},
      {day:'Thu',sales:118900},{day:'Fri',sales:143200},{day:'Sat',sales:67800},{day:'Sun',sales:41200},
    ];

    const AppCtx = createContext(null);
    const fmt = n => Number(n).toLocaleString('en-TZ');
    const genRef = () => 'UNI-' + Math.random().toString(36).substring(2,8).toUpperCase();

    function useToast() {
      const [toast, setToast] = useState(null);
      const timer = useRef();
      const show = useCallback((msg, type='default') => {
        clearTimeout(timer.current);
        setToast({msg, type});
        timer.current = setTimeout(() => setToast(null), 2600);
      }, []);
      return [toast, show];
    }
    function useClock() {
      const [time, setTime] = useState('');
      useEffect(() => {
        const tick = () => { const n = new Date(); setTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`); };
        tick(); const t = setInterval(tick, 10000); return () => clearInterval(t);
      }, []);
      return time;
    }
    function Toast({toast}) { if (!toast) return null; const colors = {default:{bg:'#1C1A17',col:'#F5F0E8'},success:{bg:'#0F6E56',col:'#fff'},error:{bg:'#A32D2D',col:'#fff'}}; const {bg,col} = colors[toast.type] || colors.default; return ( <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:bg,color:col,padding:'11px 22px',borderRadius:30,fontSize:13,fontWeight:500,zIndex:9999,whiteSpace:'nowrap',boxShadow:'0 4px 20px rgba(0,0,0,.2)',animation:'fadeUp .3s cubic-bezier(.34,1.56,.64,1)'}}>{toast.msg}</div> ); }
    function Modal({open, onClose, children, maxW=480, center=false}) { if (!open) return null; return ( <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{position:'fixed',inset:0,background:'rgba(28,26,23,.58)',display:'flex',alignItems:center?'center':'flex-end',justifyContent:'center',zIndex:500,backdropFilter:'blur(3px)'}}><div style={{background:'#FAFAF7',borderRadius:center?16:'20px 20px 0 0',padding:'24px 22px 32px',width:'100%',maxWidth:maxW,maxHeight:'90vh',overflowY:'auto',animation:'fadeUp .28s cubic-bezier(.34,1.56,.64,1)'}}>{!center && <div style={{width:40,height:4,background:'var(--border)',borderRadius:2,margin:'0 auto 20px'}}/>}{children}</div></div> ); }
    function Btn({children,onClick,variant='primary',fullWidth,disabled,small,style:sx={}}) { const base = {display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,borderRadius:10,fontFamily:'Syne,sans-serif',fontWeight:700,cursor:'pointer',transition:'background .18s,transform .1s,opacity .15s',border:'none',width:fullWidth?'100%':'auto',opacity:disabled?.55:1,pointerEvents:disabled?'none':'auto',fontSize:small?12:14,padding:small?'7px 14px':'12px 18px',...sx}; const variants = {primary:{background:'#1C1A17',color:'#F5F0E8'},rust:{background:'#C4522A',color:'#fff'},sage:{background:'#4A6741',color:'#fff'},ghost:{background:'transparent',color:'#1C1A17',border:'1px solid #E2D9CC'},danger:{background:'#A32D2D',color:'#fff'},amber:{background:'#D4831A',color:'#fff'}}; const [hover,setHover] = useState(false); const hoverBg = {primary:'#C4522A',rust:'#A03D1E',sage:'#3A5131',ghost:'#EDE8DF',danger:'#7A1F1F',amber:'#B06B10'}; return (<button onClick={onClick} style={{...base,...variants[variant],background:hover?hoverBg[variant]:variants[variant].background}} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>{children}</button>); }
    function Badge({children, color='gray'}) { const colors = {gray:{bg:'#EDE8DF',col:'#5A5040'},rust:{bg:'#F5E8E2',col:'#C4522A'},amber:{bg:'#FEF3DC',col:'#854F0B'},sage:{bg:'#EAF0E8',col:'#4A6741'},blue:{bg:'#E6F1FB',col:'#185FA5'},red:{bg:'#FCEBEB',col:'#A32D2D'}}; return (<span style={{background:colors[color].bg,color:colors[color].col,fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',padding:'3px 8px',borderRadius:6}}>{children}</span>); }
    function Input({label,value,onChange,placeholder,type='text',prefix,maxLength}) { const [focus,setFocus] = useState(false); return ( <div style={{marginBottom:12}}>{label && <div style={{fontSize:11,fontWeight:500,letterSpacing:1,textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>{label}</div>}<div style={{display:'flex',border:`1.5px solid ${focus?'var(--rust)':'var(--border)'}`,borderRadius:10,overflow:'hidden',background:'#fff',transition:'border-color .15s'}}>{prefix && <div style={{padding:'10px 12px',fontSize:12,fontWeight:500,color:'var(--muted)',background:'var(--tag)',borderRight:'1px solid var(--border)',whiteSpace:'nowrap'}}>{prefix}</div>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} style={{flex:1,padding:'10px 12px',fontSize:13,background:'transparent'}} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}/></div></div> ); }
    function StatCard({label,value,sub,color='default',icon}) { const bg = {default:'#fff',rust:'#FDF5F2',sage:'#EAF0E8',amber:'#FEF3DC',blue:'#E6F1FB'}; const col = {default:'var(--cr)',rust:'#C4522A',sage:'#4A6741',amber:'#854F0B',blue:'#185FA5'}; return ( <div style={{background:bg[color],border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',animation:'card-enter .3s ease'}}><div style={{fontSize:11,color:'var(--muted)',fontWeight:500,letterSpacing:.5,textTransform:'uppercase',marginBottom:6,display:'flex',alignItems:'center',gap:5}}>{icon && <span style={{fontSize:14}}>{icon}</span>}{label}</div><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:24,color:col[color]}}>{value}</div>{sub && <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{sub}</div>}</div> ); }
    function QRCanvas({refCode, size=180}) { const ref = useRef(); useEffect(() => { const canvas = ref.current; if(!canvas) return; const ctx = canvas.getContext('2d'); const mod = 25, cell = (size-20)/mod, offset = 10; ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size); ctx.fillStyle = '#1C1A17'; let seed = refCode.split('').reduce((a,c)=>a+c.charCodeAt(0),0); const rand = () => { seed=(seed*1664525+1013904223)&0xFFFFFFFF; return (seed>>>0)/0xFFFFFFFF; }; for(let r=0;r<mod;r++) for(let c=0;c<mod;c++) if(rand()>.5) ctx.fillRect(offset+c*cell,offset+r*cell,cell-1,cell-1); const finder = (x,y) => { ctx.fillStyle='#fff'; ctx.fillRect(offset+x*cell,offset+y*cell,7*cell,7*cell); ctx.fillStyle='#1C1A17'; ctx.fillRect(offset+x*cell,offset+y*cell,7*cell,7*cell); ctx.fillStyle='#fff'; ctx.fillRect(offset+(x+1)*cell,offset+(y+1)*cell,5*cell,5*cell); ctx.fillStyle='#1C1A17'; ctx.fillRect(offset+(x+2)*cell,offset+(y+2)*cell,3*cell,3*cell); }; finder(0,0); finder(mod-7,0); finder(0,mod-7); }, [refCode, size]); return <canvas ref={ref} width={size} height={size} style={{borderRadius:8,display:'block'}}/>; }
    function MiniBarChart({data}) { const max = Math.max(...data.map(d=>d.sales)); return ( <div style={{display:'flex',alignItems:'flex-end',gap:6,height:80,padding:'0 4px'}}>{data.map((d,i) => (<div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{width:'100%',background:i===4?'#C4522A':'#E2D9CC',borderRadius:'4px 4px 0 0',height:Math.round((d.sales/max)*70),transition:'height .4s ease'}}/><span style={{fontSize:9,color:'var(--muted)',fontWeight:500}}>{d.day}</span></div>))}</div> ); }
    function TopBar({page, setPage, user, cart, onLogout, onSettings}) {
        const time = useClock();
        const cartCount = Object.values(cart).reduce((s,i)=>s+i.qty,0);
        const navItems = user.role === 'student'
            ? [{key:'menu',label:'Menu',icon:'🍽️'},{key:'orders',label:'My Orders',icon:'📋'}]
            : user.role === 'staff'
            ? [{key:'scanner',label:'Scanner',icon:'📷'},{key:'queue',label:'Queue',icon:'📋'}]
            : [{key:'dashboard',label:'Dashboard',icon:'📊'},{key:'menu-mgmt',label:'Menu',icon:'🍽️'},{key:'orders-mgmt',label:'Orders',icon:'📋'},{key:'users',label:'Users',icon:'👥'},{key:'reports',label:'Reports',icon:'📈'}];

        return (
            <header style={{
                background:'#1C1A17',color:'#F5F0E8',
                padding:'0 12px',height:'auto',minHeight:52,
                display:'flex',alignItems:'center',justifyContent:'space-between',
                position:'sticky',top:0,zIndex:200,flexShrink:0,
                gap:8,flexWrap:'wrap',overflow:'visible'
            }}>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',flex:1}}>
                    <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,letterSpacing:-.5,display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:'#E8693D'}}/>
                        UniEat
                    </div>
                    <nav style={{display:'flex',gap:2,flexWrap:'wrap',flexShrink:1}}>
                        {navItems.map(n => (
                            <button key={n.key} onClick={()=>setPage(n.key)} style={{
                                padding:'6px 10px',borderRadius:8,fontSize:12,fontWeight:500,
                                background:page===n.key?'rgba(255,255,255,.1)':'transparent',
                                color:page===n.key?'#F5F0E8':'#6A6050',
                                transition:'background .15s,color .15s',display:'flex',alignItems:'center',gap:5,
                                whiteSpace:'nowrap'
                            }}>
                                <span style={{fontSize:13}}>{n.icon}</span>
                                <span style={{display:'inline-block'}}>{n.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                    <span style={{fontSize:11,color:'#4A4030',display:window.innerWidth<=560?'none':'inline'}}>{time}</span>
                    <UserMenu user={user} onLogout={onLogout} onSettings={onSettings} />
                </div>
            </header>
        );
    }
    function CartSidebar({cart, setCart, setPage, isOpen, onToggle}) {
      const {showToast} = useContext(AppCtx);
      const [payMethod, setPayMethod] = useState('mpesa');
      const [phone, setPhone] = useState('');
      const [payState, setPayState] = useState(null);
      const [qrRef, setQrRef] = useState('');
      const [countdown, setCountdown] = useState(25);
      const cartIds = Object.keys(cart);
      const subtotal = cartIds.reduce((s,k)=>s+cart[k].price*cart[k].qty,0);
      const service = Math.round(subtotal*0.02);
      const total = subtotal+service;
      const itemCount = cartIds.reduce((s,k)=>s+cart[k].qty,0);
      const isEmpty = cartIds.length===0;
      const changeQty = (id, d) => setCart(prev => { const next={...prev}; if(!next[id])return prev; next[id]={...next[id],qty:next[id].qty+d}; if(next[id].qty<=0)delete next[id]; return next; });
      const startCheckout = () => { const digits = phone.replace(/\D/g,''); if(digits.length<9){showToast('⚠ Enter your phone number','error');return;} if(isEmpty)return; setPayState('processing'); let c=25; setCountdown(25); const t=setInterval(()=>{c--;setCountdown(c);if(c<=0)clearInterval(t);},1000); setTimeout(()=>{clearInterval(t);setQrRef(genRef());setPayState('success');},3000); };
      const payColors = {mpesa:'#00A651',tigo:'#003087',halo:'#E31837'}; const payLabels = {mpesa:'M-Pesa',tigo:'Tigo Pesa',halo:'HaloPesa'};
      return ( <div className={`cart-sidebar ${!isOpen ? 'hide-cart' : ''}`} style={{background:'#FAFAF7',borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',height:'100%',overflowY:'auto',position:'relative'}}><div className="cart-handle" onClick={onToggle} style={{display:'none'}}/><div style={{padding:'14px 16px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14}}>Your order</span><span style={{background:isEmpty?'#EDE8DF':'#C4522A',color:isEmpty?'var(--muted)':'#fff',borderRadius:10,padding:'2px 8px',fontSize:10,fontWeight:600}}>{itemCount} item{itemCount!==1?'s':''}</span><button onClick={onToggle} className="close-cart-mobile" style={{display:'none',background:'none',fontSize:20,color:'var(--muted)'}}>✕</button></div>{isEmpty ? ( <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:24,textAlign:'center'}}><div style={{fontSize:38,opacity:.2}}>🍽️</div><div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>Add meals from the menu<br/>to get started</div></div> ) : ( <> <div style={{flex:1,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,overflowY:'auto'}}>{cartIds.map(k => { const it = cart[k]; return ( <div key={k} style={{display:'flex',alignItems:'center',gap:8,animation:'slideLeft .2s ease'}}><span style={{fontSize:24,flexShrink:0}}>{it.emoji}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div><div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{fmt(it.price*it.qty)} TZS</div></div><div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}><button onClick={()=>changeQty(k,-1)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--border)',background:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,minWidth:16,textAlign:'center'}}>{it.qty}</span><button onClick={()=>changeQty(k,1)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--border)',background:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button></div></div> ); })}</div><div style={{borderTop:'1px solid var(--border)',padding:'12px 14px',flexShrink:0}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginBottom:4}}><span>Subtotal</span><span>TZS {fmt(subtotal)}</span></div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)'}}><span>Service (2%)</span><span>TZS {fmt(service)}</span></div><div style={{display:'flex',justifyContent:'space-between',fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}><span>Total</span><span>TZS {fmt(total)}</span></div></div><div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',flexShrink:0}}><div style={{fontSize:9,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase',color:'var(--muted)',marginBottom:8}}>Pay with</div><div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:9}}>{['mpesa','tigo','halo'].map(m => (<div key={m} onClick={()=>setPayMethod(m)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:`1.5px solid ${payMethod===m?'#C4522A':'var(--border)'}`,borderRadius:8,cursor:'pointer',background:payMethod===m?'#FDF5F2':'#fff'}}><div style={{width:34,height:20,borderRadius:4,background:payColors[m],display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'#fff'}}>{payLabels[m]}</div><span style={{fontSize:12,fontWeight:500,flex:1}}>{payLabels[m]}</span><div style={{width:14,height:14,borderRadius:'50%',border:`1.5px solid ${payMethod===m?'#C4522A':'var(--border)'}`,background:payMethod===m?'#C4522A':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{payMethod===m && <div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}</div></div>))}</div><div style={{display:'flex',border:`1.5px solid ${phone?'#C4522A':'var(--border)'}`,borderRadius:8,overflow:'hidden',background:'#fff'}}><div style={{padding:'8px 10px',fontSize:11,fontWeight:500,color:'var(--muted)',background:'var(--tag)',borderRight:'1px solid var(--border)'}}>🇹🇿 +255</div><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" maxLength={9} placeholder="7XX XXX XXX" style={{flex:1,padding:'8px 10px',fontSize:12}}/></div></div><div style={{padding:'10px 14px 16px',flexShrink:0}}><button onClick={startCheckout} style={{width:'100%',background:'#1C1A17',color:'#F5F0E8',border:'none',borderRadius:10,padding:'13px 14px',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span>Pay now</span><span style={{background:'rgba(255,255,255,.12)',padding:'3px 9px',borderRadius:6,fontSize:12}}>TZS {fmt(total)}</span></button></div></> )}{payState && ( <div style={{position:'fixed',inset:0,background:'rgba(28,26,23,.6)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:600,backdropFilter:'blur(3px)'}}><div style={{background:'#FAFAF7',borderRadius:'20px 20px 0 0',padding:'24px 22px 36px',width:'100%',maxWidth:440,animation:'fadeUp .28s cubic-bezier(.34,1.56,.64,1)'}}><div style={{width:40,height:4,background:'var(--border)',borderRadius:2,margin:'0 auto 22px'}}/>{payState==='processing' ? (<div style={{textAlign:'center'}}><div style={{width:40,height:40,border:'3px solid var(--border)',borderTopColor:'#C4522A',borderRadius:'50%',margin:'0 auto 16px',animation:'spin .7s linear infinite'}}/><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,marginBottom:5}}>Awaiting payment</div><div style={{fontSize:12,color:'var(--muted)',lineHeight:1.7}}>Check your phone for the<br/>{payLabels[payMethod]} STK push</div><div style={{fontSize:10,color:'var(--muted)',opacity:.5,marginTop:12,animation:'pulse 1s ease infinite'}}>Expires in {countdown}s</div></div>) : (<div style={{textAlign:'center'}}><div style={{width:54,height:54,borderRadius:'50%',background:'#4A6741',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:24,color:'#fff'}}>✓</div><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:19,marginBottom:3}}>Payment confirmed!</div><div style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Show this QR code at the counter</div><div style={{width:180,height:180,background:'#fff',border:'2px solid var(--border)',borderRadius:12,margin:'0 auto 10px',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}><QRCanvas refCode={qrRef} size={180}/></div><div style={{fontFamily:'Syne,sans-serif',fontSize:12,fontWeight:700,letterSpacing:2,color:'var(--muted)',marginBottom:4}}>{qrRef}</div><div style={{fontSize:10,color:'var(--muted)',lineHeight:1.7,maxWidth:240,margin:'0 auto 18px'}}>Show to canteen staff to receive your order.<br/>Valid 30 minutes · one use only.</div><button onClick={()=>{setPayState(null);setCart({});setPhone('');}} style={{background:'#EDE8DF',border:'none',borderRadius:9,padding:'11px 26px',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1C1A17'}}>Done — new order</button></div>)}</div></div> )}</div> ); }
    function MenuPage({cart, setCart, setPage}) { const {showToast} = useContext(AppCtx); const [cat, setCat] = useState('all'); const [modalMeal, setModalMeal] = useState(null); const [modalQty, setModalQty] = useState(1); const [search, setSearch] = useState(''); const [cartOpen, setCartOpen] = useState(true); const addToCart = useCallback((item, qty) => { setCart(prev => { const next = {...prev}; next[item.id] = next[item.id] ? {...next[item.id], qty: next[item.id].qty+qty} : {...item, qty}; return next; }); showToast(`✓ ${item.name.split(' ')[0]} added`, 'success'); if(window.innerWidth<=800) setCartOpen(true); }, [setCart, showToast]); const allItems = [...MEALS, ...DRINKS]; const filtered = useMemo(() => { let items = cat==='all' ? MEALS : cat==='drinks' ? DRINKS : MEALS.filter(m=>m.cat===cat); if (search.trim()) items = [...MEALS,...DRINKS].filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.desc.toLowerCase().includes(search.toLowerCase())); return items; }, [cat, search]); const showDrinks = (cat==='all' || cat==='drinks') && !search; const showMeals = cat!=='drinks' || !!search; const mealItems = search ? filtered.filter(m=>m.cat!=='drinks') : (cat==='drinks'?[]:filtered); const drinkItems = search ? filtered.filter(m=>m.cat==='drinks') : DRINKS; const cartCount = Object.values(cart).reduce((s,i)=>s+i.qty,0); return ( <div className="menu-layout" style={{display:'flex',flex:1,minHeight:0,overflow:'hidden'}}><div className="menu-left" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{background:'#2D2520',padding:'20px 20px 16px',flexShrink:0}}><div style={{fontSize:9,letterSpacing:2.5,textTransform:'uppercase',color:'#F0A030',fontWeight:600,marginBottom:3}}>Today's canteen</div><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:22,color:'#F5F0E8',lineHeight:1.1,marginBottom:2}}>What are you having today?</div><div style={{fontSize:11,color:'#6A6050',marginBottom:14}}>Fresh meals served 07:00 – 20:00</div><div style={{display:'flex',gap:5}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search meals & drinks…" style={{flex:1,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#F5F0E8'}}/>{search && <button onClick={()=>setSearch('')} style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 12px',color:'#9A9080'}}>✕</button>}</div></div>{!search && (<div style={{background:'#FAFAF7',borderBottom:'1px solid var(--border)',flexShrink:0,overflowX:'auto'}}><div style={{display:'flex',padding:'0 16px',gap:2}}>{CATS.map(c => { const count = c.key==='all'?MEALS.length+DRINKS.length:c.key==='drinks'?DRINKS.length:MEALS.filter(m=>m.cat===c.key).length; return (<button key={c.key} onClick={()=>setCat(c.key)} style={{padding:'11px 10px',fontSize:11,fontWeight:500,whiteSpace:'nowrap',color:cat===c.key?'#C4522A':'var(--muted)',borderBottom:`2px solid ${cat===c.key?'#C4522A':'transparent'}`}}>{c.label}<span style={{background:cat===c.key?'#F5E8E2':'#EDE8DF',color:cat===c.key?'#C4522A':'var(--muted)',borderRadius:10,padding:'1px 6px',fontSize:9,marginLeft:5}}>{count}</span></button>);})}</div></div>)}<div style={{overflowY:'auto',padding:18,flex:1}}>{search && filtered.length===0 && (<div style={{textAlign:'center',padding:'60px 20px',color:'var(--muted)'}}><div style={{fontSize:36,marginBottom:12}}>🔍</div><div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,marginBottom:4}}>No results for "{search}"</div><div style={{fontSize:13}}>Try a different search term</div></div>)}{showMeals && mealItems.length>0 && (<><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15}}>{search?'Meals':(cat==='all'?'All meals':cat.charAt(0).toUpperCase()+cat.slice(1))}</span><span style={{fontSize:11,color:'var(--muted)'}}>{mealItems.length} items</span></div><div className="menu-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(185px,1fr))',gap:11,marginBottom:22}}>{mealItems.map(m => <MealCard key={m.id} meal={m} onAdd={addToCart} onOpen={m=>{setModalMeal(m);setModalQty(1)}}/>)}</div></>)}{showDrinks && drinkItems.length>0 && (<><div style={{marginBottom:10}}><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15}}>Drinks</span></div><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{drinkItems.map(d => <DrinkChip key={d.id} drink={d} onAdd={addToCart}/>)}</div></>)}</div></div><CartSidebar cart={cart} setCart={setCart} setPage={setPage} isOpen={cartOpen} onToggle={()=>setCartOpen(!cartOpen)}/><button className="cart-toggle" onClick={()=>setCartOpen(true)} style={{display: window.innerWidth <= 800 ? 'flex' : 'none', position:'fixed', bottom:20, right:20, background:'#C4522A', color:'white', borderRadius:40, padding:'10px 18px', zIndex:250, boxShadow:'0 4px 12px rgba(0,0,0,0.2)', alignItems:'center', gap:8, border:'none', fontSize:13, fontWeight:'bold'}}>🛒 {cartCount}</button><Modal open={!!modalMeal} onClose={()=>setModalMeal(null)}>{modalMeal && <>...</>}</Modal></div> ); }
    function MealCard({meal, onAdd, onOpen}) { const [added, setAdded] = useState(false); const handleQuickAdd = e => { e.stopPropagation(); onAdd(meal, 1); setAdded(true); setTimeout(()=>setAdded(false), 800); }; return ( <div onClick={()=>meal.stock && onOpen(meal)} style={{background:meal.stock?'#fff':'#F8F6F2',border:`1px solid ${meal.stock?'#E2D9CC':'#EDE8DF'}`,borderRadius:14,overflow:'hidden',cursor:meal.stock?'pointer':'not-allowed',opacity:meal.stock?1:.6,transition:'transform .18s,box-shadow .18s'}}><div style={{height:110,background:CAT_COLORS[meal.cat]||'#EDE8DF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:46,position:'relative'}}>{meal.emoji}{meal.badge && (<span style={{position:'absolute',top:8,left:8,background:meal.badge==='popular'?'#C4522A':meal.badge==='new'?'#D4831A':'#4A6741',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 7px',borderRadius:5}}>{meal.badge}</span>)}{!meal.stock && <span style={{position:'absolute',top:8,right:8,background:'rgba(28,26,23,.65)',color:'#fff',fontSize:8,padding:'2px 7px',borderRadius:5}}>SOLD OUT</span>}</div><div style={{padding:'10px 12px 12px'}}><div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,marginBottom:2}}>{meal.name}</div><div style={{fontSize:10.5,color:'var(--muted)',marginBottom:8,lineHeight:1.4}}>{meal.desc}</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14}}>{fmt(meal.price)} <span style={{fontSize:9,fontWeight:400,color:'var(--muted)'}}>TZS</span></div>{meal.stock && (<button onClick={handleQuickAdd} style={{width:28,height:28,borderRadius:'50%',background:added?'#4A6741':'#1C1A17',color:'#fff',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',animation:added?'pop .3s ease':'none'}}>{added?'✓':'+'}</button>)}</div></div></div> ); }
    function DrinkChip({drink, onAdd}) { const [added, setAdded] = useState(false); return ( <div style={{display:'flex',alignItems:'center',gap:9,background:'#fff',border:'1px solid var(--border)',borderRadius:50,padding:'7px 13px 7px 9px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#1C1A17'}><span style={{fontSize:20}}>{drink.emoji}</span><div><div style={{fontSize:12,fontWeight:500}}>{drink.name}</div><div style={{fontSize:10,color:'var(--muted)'}}>{fmt(drink.price)} TZS</div></div><button onClick={()=>{onAdd(drink,1);setAdded(true);setTimeout(()=>setAdded(false),700)}} style={{width:22,height:22,borderRadius:'50%',background:added?'#4A6741':'#1C1A17',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>{added?'✓':'+'}</button></div> ); }
    function OrdersPage() { const myOrders = SAMPLE_ORDERS.slice(0,3); return ( <div style={{padding:24,maxWidth:680,margin:'0 auto'}}><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:22}}>My Orders</div><div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>Your recent transactions</div>{myOrders.map(o => (<div key={o.id} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'14px 16px',marginBottom:12}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><div><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13}}>{o.id}</span><span style={{fontSize:10,color:'var(--muted)',marginLeft:8}}>{o.time} today</span></div><Badge color={o.status==='served'?'sage':'amber'}>{o.status==='served'?'Served':'Pending'}</Badge></div><div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>{o.items.map((it,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--muted)'}}>{it.qty}× {it.name}</span><span>{fmt(it.price)} TZS</span></div>))}</div><div style={{display:'flex',justifyContent:'space-between',paddingTop:10,borderTop:'1px solid var(--border)'}}><div style={{fontSize:11,color:'var(--muted)'}}>via {o.paid==='mpesa'?'M-Pesa':o.paid==='tigo'?'Tigo Pesa':'HaloPesa'}</div><span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14}}>TZS {fmt(o.total)}</span></div></div>))}</div> ); }
    function ScannerPage() { const {showToast} = useContext(AppCtx); const [input, setInput] = useState(''); const [result, setResult] = useState(null); const [scanning, setScanning] = useState(false); const handleVerify = (code) => { const c = (code||input).toUpperCase().trim(); if (!c) return; setScanning(true); setResult(null); setTimeout(() => { setScanning(false); const order = SAMPLE_ORDERS.find(o=>o.id===c); if (order) { if (order.status==='served') { setResult({type:'used',order}); showToast('⚠ QR already used', 'error'); } else { setResult({type:'valid',order}); showToast('✓ Valid order — ready to serve', 'success'); } } else { setResult({type:'invalid'}); showToast('✗ Invalid QR code', 'error'); } }, 1200); }; const markServed = () => { if (result?.order) { result.order.status = 'served'; setResult({...result, type:'done'}); showToast('✓ Order marked as served', 'success'); } }; return ( <div className="staff-scanner-layout" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,flex:1,overflow:'auto'}}><div style={{padding:28,borderRight:'1px solid var(--border)'}}><div><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:20}}>QR Scanner</div><div style={{fontSize:12,color:'var(--muted)'}}>Verify student orders</div></div><div style={{background:'#1C1A17',borderRadius:16,padding:20,marginTop:20,position:'relative',aspectRatio:'1',maxWidth:320}}><div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'#C4522A',opacity:.7,animation:'scanline 2s linear infinite'}}/><div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%'}}><div style={{fontSize:40}}>📷</div><div style={{fontSize:11,color:'#6A6050'}}>Camera scanner</div></div></div><div style={{marginTop:20}}><div style={{fontSize:10,fontWeight:600,letterSpacing:1,color:'var(--muted)',marginBottom:8}}>Or enter code manually</div><div style={{display:'flex',gap:8}}><input value={input} onChange={e=>setInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&handleVerify()} placeholder="e.g. UNI-AB3X7K" style={{flex:1,padding:'10px 12px',fontSize:13,background:'#fff',border:'1.5px solid var(--border)',borderRadius:9}}/><Btn variant="rust" onClick={()=>handleVerify()}>Verify</Btn></div><div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>{SAMPLE_ORDERS.map(o=>(<button key={o.id} onClick={()=>{setInput(o.id);handleVerify(o.id);}} style={{fontSize:10,padding:'4px 9px',borderRadius:6,background:'#EDE8DF'}}>{o.id}</button>))}</div></div></div><div style={{padding:28,display:'flex',justifyContent:'center',alignItems:'center',background:'#FAFAF7'}}>{scanning && (<div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'3px solid var(--border)',borderTopColor:'#C4522A',borderRadius:'50%',margin:'0 auto 16px',animation:'spin .7s linear infinite'}}/><div style={{fontWeight:700}}>Verifying…</div></div>)}{!scanning && !result && (<div style={{textAlign:'center',opacity:.35}}><div style={{fontSize:54}}>🔲</div><div style={{fontWeight:700}}>Awaiting scan</div></div>)}{!scanning && result && (<div style={{width:'100%',maxWidth:340}}>{result.type==='valid' && (<><div style={{background:'#EAF0E8',borderRadius:16,padding:20,textAlign:'center'}}><div style={{width:52,height:52,borderRadius:'50%',background:'#4A6741',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 10px',fontSize:22,color:'#fff'}}>✓</div><div style={{fontWeight:800,fontSize:18}}>Valid Order</div><div>{result.order.id}</div></div><Btn fullWidth variant="sage" onClick={markServed}>✓ Mark as Served</Btn></>)}</div>)}</div></div> ); }
    function QueuePage() { const {showToast} = useContext(AppCtx); const [orders, setOrders] = useState(SAMPLE_ORDERS.map(o=>({...o}))); const pending = orders.filter(o=>o.status==='pending'); const served = orders.filter(o=>o.status==='served'); const markServed = (id) => { setOrders(prev => prev.map(o=>o.id===id?{...o,status:'served'}:o)); showToast('✓ Order marked as served', 'success'); }; const OrderCard = ({o}) => ( <div style={{background:'#fff',border:`1px solid ${o.status==='pending'?'#E2D9CC':'#D3D1C7'}`,borderRadius:12,padding:'12px 14px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><div><div style={{fontWeight:700,fontSize:12}}>{o.id}</div><div style={{fontSize:12}}>{o.student}</div></div><Badge color={o.status==='served'?'sage':'amber'}>{o.status==='served'?'Served':'Pending'}</Badge></div><div style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>{o.items.map(it=>`${it.qty}× ${it.name}`).join(' · ')}</div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700}}>TZS {fmt(o.total)}</span>{o.status==='pending' && <Btn small variant="sage" onClick={()=>markServed(o.id)}>Mark served</Btn>}</div></div> ); return ( <div className="queue-layout" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,flex:1,overflow:'auto'}}><div style={{padding:20,borderRight:'1px solid var(--border)',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}><span style={{fontWeight:700}}>Pending</span><span style={{background:'#FEF3DC',color:'#854F0B',borderRadius:10,padding:'2px 8px',fontSize:10}}>{pending.length}</span></div><div style={{display:'flex',flexDirection:'column',gap:10}}>{pending.map(o=><OrderCard key={o.id} o={o}/>)}</div></div><div style={{padding:20,overflowY:'auto',background:'#FAFAF7'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}><span style={{fontWeight:700}}>Served today</span><span style={{background:'#EAF0E8',color:'#4A6741',borderRadius:10,padding:'2px 8px'}}>{served.length}</span></div><div>{served.map(o=><OrderCard key={o.id} o={o}/>)}</div></div></div> ); }
    function DashboardPage() { return ( <div style={{padding:24,overflowY:'auto'}}><div style={{fontWeight:800,fontSize:22}}>Dashboard</div><div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>{new Date().toLocaleDateString('en-TZ',{weekday:'long',day:'numeric',month:'long'})}</div><div className="admin-dashboard-stats" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}><StatCard label="Revenue today" value="TZS 143,200" sub="+18%" color="rust" icon="💰"/><StatCard label="Orders placed" value="47" sub="12 pending" color="amber" icon="📋"/><StatCard label="Items sold" value="134" sub="18 types" color="sage" icon="🍽️"/><StatCard label="Avg order" value="TZS 3,047" color="blue" icon="📊"/></div><div className="admin-grid-2col" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:20}}><div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:18}}><div style={{fontWeight:700,fontSize:15}}>Weekly sales</div><MiniBarChart data={SALES_DATA}/></div><div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:18}}><div style={{fontWeight:700,fontSize:15}}>Payment methods</div>{[{label:'M-Pesa',pct:62,col:'#00A651'},{label:'Tigo Pesa',pct:27,col:'#003087'},{label:'HaloPesa',pct:11,col:'#E31837'}].map(p=>(<div key={p.label} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>{p.label}</span><span>{p.pct}%</span></div><div style={{height:6,background:'#EDE8DF',borderRadius:3}}><div style={{height:'100%',width:p.pct+'%',background:p.col,borderRadius:3}}/></div></div>))}</div></div></div> ); }
    function MenuMgmtPage() { const {showToast} = useContext(AppCtx); const [meals, setMeals] = useState(MEALS.map(m=>({...m}))); const [editing, setEditing] = useState(null); const [editForm, setEditForm] = useState({}); const [showAdd, setShowAdd] = useState(false); const [newMeal, setNewMeal] = useState({name:'',desc:'',price:'',cat:'lunch',emoji:'🍽️',badge:'',stock:true}); const toggleStock = (id) => { setMeals(prev=>prev.map(m=>m.id===id?{...m,stock:!m.stock}:m)); showToast('Menu updated', 'success'); }; const startEdit = (meal) => { setEditing(meal.id); setEditForm({...meal}); }; const saveEdit = () => { setMeals(prev=>prev.map(m=>m.id===editing?{...editForm,id:m.id,price:Number(editForm.price)}:m)); setEditing(null); showToast('✓ Meal updated', 'success'); }; const addMeal = () => { if(!newMeal.name||!newMeal.price){showToast('Fill in name & price','error');return;} setMeals(prev=>[...prev,{...newMeal,id:Date.now(),price:Number(newMeal.price)}]); setShowAdd(false); setNewMeal({name:'',desc:'',price:'',cat:'lunch',emoji:'🍽️',badge:'',stock:true}); showToast('✓ Meal added', 'success'); }; return ( <div style={{padding:22,overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}><div><div style={{fontWeight:800,fontSize:20}}>Menu Management</div><div style={{fontSize:12,color:'var(--muted)'}}>{meals.length} items</div></div><Btn variant="rust" onClick={()=>setShowAdd(true)}>+ Add meal</Btn></div><div className="admin-menu-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>{meals.map(m=>(<div key={m.id} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px'}}><div style={{display:'flex',justifyContent:'space-between'}}><div style={{display:'flex',gap:10}}><span style={{fontSize:26}}>{m.emoji}</span><div><div style={{fontWeight:700,fontSize:13}}>{m.name}</div><div style={{fontSize:10}}>{m.cat} · TZS {fmt(m.price)}</div></div></div><div><button onClick={()=>startEdit(m)} style={{border:'1px solid var(--border)',padding:'4px 7px',borderRadius:6}}>✏️</button><button onClick={()=>setMeals(prev=>prev.filter(x=>x.id!==m.id))} style={{marginLeft:6,border:'1px solid var(--border)',padding:'4px 7px',borderRadius:6}}>🗑️</button></div></div><div style={{marginTop:10,display:'flex',justifyContent:'space-between'}}><div onClick={()=>toggleStock(m.id)} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}><div style={{width:32,height:18,borderRadius:9,background:m.stock?'#4A6741':'#E2D9CC',position:'relative'}}><div style={{width:14,height:14,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:m.stock?16:2}}/></div><span style={{fontSize:10}}>{m.stock?'Available':'Off menu'}</span></div></div></div>))}</div><Modal open={!!editing} onClose={()=>setEditing(null)} maxW={420} center><div style={{fontWeight:800,fontSize:18}}>Edit meal</div><Input label="Name" value={editForm.name||''} onChange={v=>setEditForm(f=>({...f,name:v}))}/><Input label="Price" type="number" value={editForm.price||''} onChange={v=>setEditForm(f=>({...f,price:v}))}/><Btn fullWidth variant="rust" onClick={saveEdit}>Save</Btn></Modal><Modal open={showAdd} onClose={()=>setShowAdd(false)} maxW={420} center><div style={{fontWeight:800,fontSize:18}}>Add new meal</div><Input label="Name" value={newMeal.name} onChange={v=>setNewMeal(f=>({...f,name:v}))}/><Input label="Price" type="number" value={newMeal.price} onChange={v=>setNewMeal(f=>({...f,price:v}))}/><Btn fullWidth variant="sage" onClick={addMeal}>Add to menu</Btn></Modal></div> ); }
    function OrdersMgmtPage() { const [filter, setFilter] = useState('all'); const [orders] = useState(SAMPLE_ORDERS.map(o=>({...o}))); const filtered = filter==='all'?orders:orders.filter(o=>o.status===filter); return ( <div style={{padding:22,overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}><div><div style={{fontWeight:800,fontSize:20}}>All Orders</div><div style={{fontSize:12}}>{orders.length} orders today</div></div><div style={{display:'flex',gap:6}}>{['all','pending','served'].map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 14px',borderRadius:8,background:filter===f?'#1C1A17':'#fff',color:filter===f?'#F5F0E8':'var(--cr)'}}>{f}</button>))}</div></div><div className="order-table" style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:'var(--tag)'}}>{['Order ID','Student','Items','Total','Method','Time','Status'].map(h=><th key={h} style={{padding:'10px 14px',fontSize:10,textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{filtered.map(o=>(<tr key={o.id}><td data-label="Order ID" style={{padding:'12px 14px'}}>{o.id}</td><td data-label="Student">{o.student}</td><td data-label="Items" style={{fontSize:11}}>{o.items.map(it=>`${it.qty}× ${it.name}`).join(', ')}</td><td data-label="Total">TZS {fmt(o.total)}</td><td data-label="Method"><Badge color={o.paid==='mpesa'?'sage':'blue'}>{o.paid}</Badge></td><td data-label="Time">{o.time}</td><td data-label="Status"><Badge color={o.status==='served'?'sage':'amber'}>{o.status}</Badge></td></tr>))}</tbody></table></div></div> ); }
    function ReportsPage() { return ( <div style={{padding:24,overflowY:'auto'}}><div style={{fontWeight:800,fontSize:20}}>Reports</div><div className="admin-dashboard-stats" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}><StatCard label="This month" value="TZS 2.4M" sub="89 hours" color="rust" icon="📅"/><StatCard label="Total orders" value="1,247" color="amber" icon="📋"/><StatCard label="Top payer" value="M-Pesa" color="sage" icon="📱"/></div><div className="admin-grid-2col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:18}}><div style={{fontWeight:700,fontSize:15}}>Daily revenue</div><MiniBarChart data={SALES_DATA}/></div><div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:18}}><div style={{fontWeight:700,fontSize:15}}>Category breakdown</div>{[{label:'Lunch',pct:38},{label:'Dinner',pct:29},{label:'Breakfast',pct:18}].map(c=>(<div key={c.label} style={{display:'flex',gap:8,marginBottom:8}}><span style={{width:70}}>{c.label}</span><div style={{flex:1,height:6,background:'#EDE8DF'}}><div style={{width:c.pct+'%',height:'100%',background:'#C4522A'}}/></div><span>{c.pct}%</span></div>))}</div></div></div> ); }
    function LoginScreen({onLogin}) { const [role, setRole] = useState('student'); const [id, setId] = useState(''); const [pass, setPass] = useState(''); const [loading, setLoading] = useState(false); const [err, setErr] = useState(''); const creds = { student:{id:'CS/2022/042',pass:'student123',name:'John M.',initials:'JM'}, staff:{id:'STAFF001',pass:'staff123',name:'Mary K.',initials:'MK'}, admin:{id:'ADMIN001',pass:'admin123',name:'Dr. Osei',initials:'DO'}, }; const handleLogin = () => { const c = creds[role]; if(id===c.id && pass===c.pass) { setLoading(true); setTimeout(()=>onLogin({role,name:c.name,initials:c.initials,id}),1000); } else { setErr('Incorrect credentials.'); } }; return ( <div style={{minHeight:'100vh',background:'#1C1A17',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{width:'100%',maxWidth:400}}><div style={{textAlign:'center',marginBottom:32}}><div style={{fontFamily:'Syne',fontWeight:800,fontSize:32,color:'#F5F0E8'}}>UniEat</div><div style={{fontSize:12,color:'#4A4030'}}>University Canteen System</div></div><div style={{display:'flex',background:'#2D2520',borderRadius:12,padding:4,marginBottom:20,gap:3}}>{[['student','Student'],['staff','Staff'],['admin','Admin']].map(([r,l])=>(<button key={r} onClick={()=>{setRole(r);setErr('');}} style={{flex:1,padding:'8px',borderRadius:9,background:role===r?'#C4522A':'transparent',color:role===r?'#fff':'#6A6050'}}>{l}</button>))}</div><div style={{background:'#2D2520',borderRadius:16,padding:22}}><div style={{marginBottom:12}}><div style={{fontSize:10,color:'#6A6050',marginBottom:6}}>{role==='student'?'University ID':'Staff ID'}</div><input value={id} onChange={e=>setId(e.target.value)} placeholder={creds[role].id} style={{width:'100%',padding:'11px 14px',background:'#1C1A17',border:'1.5px solid #3A3530',borderRadius:10,color:'#F5F0E8'}}/></div><div style={{marginBottom:16}}><div style={{fontSize:10,color:'#6A6050',marginBottom:6}}>Password</div><input value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} type="password" placeholder="••••••••" style={{width:'100%',padding:'11px 14px',background:'#1C1A17',border:'1.5px solid #3A3530',borderRadius:10,color:'#F5F0E8'}}/></div>{err && <div style={{fontSize:11,color:'#E8693D',marginBottom:12}}>{err}</div>}<button onClick={handleLogin} style={{width:'100%',background:loading?'#3A3530':'#C4522A',color:'#fff',borderRadius:10,padding:14,fontWeight:700}}>Sign in →</button><div style={{fontSize:10,color:'#4A4030',marginTop:14,textAlign:'center'}}>Demo: {creds[role].id} / {creds[role].pass}</div></div>{role==='student' && (<button onClick={()=>onLogin({role:'student',name:'Guest',initials:'GU',id:'GUEST'})} style={{width:'100%',marginTop:10,padding:'11px',borderRadius:12,border:'1px solid #3A3530',background:'transparent',color:'#6A6050'}}>Guest mode</button>)}</div></div> ); }
    function SettingsPage({user, onUpdateUser}) {
        const { showToast } = useContext(AppCtx);
        const [formData, setFormData] = useState({
            name: user.name || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        const [isLoading, setIsLoading] = useState(false);
        const [showPasswordForm, setShowPasswordForm] = useState(false);

        const handleInputChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleUpdateProfile = async (e) => {
            e.preventDefault();
            setIsLoading(true);

            setTimeout(() => {
                if (formData.name.trim() === '') {
                    showToast('Name cannot be empty', 'error');
                    setIsLoading(false);
                    return;
                }

                const updatedUser = { ...user, name: formData.name };
                onUpdateUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                showToast('Profile updated successfully!', 'success');
                setIsLoading(false);
            }, 1000);
        };

        const handleChangePassword = async (e) => {
            e.preventDefault();

            if (formData.newPassword !== formData.confirmPassword) {
                showToast('New passwords do not match', 'error');
                return;
            }

            if (formData.newPassword.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }

            setIsLoading(true);

            setTimeout(() => {
                showToast('Password changed successfully!', 'success');
                setFormData(prev => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));
                setShowPasswordForm(false);
                setIsLoading(false);
            }, 1000);
        };

        return (
            <div style={{ padding: 24, maxWidth: 600, margin: '0 auto', animation: 'fadeIn .25s ease' }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 4 }}>
                        Settings
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Manage your account preferences
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: user.role === 'admin' ? '#185FA5' : user.role === 'staff' ? '#4A6741' : '#C4522A',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, fontWeight: 700, color: '#fff'
                        }}>
                            {user.initials}
                        </div>
                        <div>
                            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 18 }}>{user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {user.role === 'student' ? `Student ID: ${user.id}` : `${user.role === 'staff' ? 'Staff' : 'Admin'} ID: ${user.id}`}
                            </div>
                        </div>
                    </div>

                    {/* Profile Information */}
                    <form onSubmit={handleUpdateProfile}>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                                Display Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                style={{
                                    width: '100%', padding: '10px 14px',
                                    border: '1.5px solid var(--border)', borderRadius: 10,
                                    fontSize: 14, background: '#fff'
                                }}
                                placeholder="Your full name"
                            />
                        </div>

                        <Btn type="submit" variant="rust" fullWidth disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Update Profile'}
                        </Btn>
                    </form>
                </div>

                {/* Password Change Section */}
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16 }}>Security</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Change your password</div>
                        </div>
                        {!showPasswordForm && (
                            <Btn small variant="ghost" onClick={() => setShowPasswordForm(true)}>
                                Change Password
                            </Btn>
                        )}
                    </div>

                    {showPasswordForm && (
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={formData.currentPassword}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        border: '1.5px solid var(--border)', borderRadius: 10,
                                        fontSize: 14, background: '#fff'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        border: '1.5px solid var(--border)', borderRadius: 10,
                                        fontSize: 14, background: '#fff'
                                    }}
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        border: '1.5px solid var(--border)', borderRadius: 10,
                                        fontSize: 14, background: '#fff'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <Btn type="button" variant="ghost" onClick={() => {
                                    setShowPasswordForm(false);
                                    setFormData(prev => ({
                                        ...prev,
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: ''
                                    }));
                                }}>
                                    Cancel
                                </Btn>
                                <Btn type="submit" variant="rust" disabled={isLoading}>
                                    {isLoading ? 'Changing...' : 'Change Password'}
                                </Btn>
                            </div>
                        </form>
                    )}
                </div>

                {/* Account Info */}
                <div style={{ marginTop: 20, padding: 16, background: 'var(--tag)', borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                        Account created: Demo Mode • Last login: Today
                    </div>
                </div>
            </div>
        );
    }
    function UserMenu({ user, onLogout, onSettings }) {
        const [isOpen, setIsOpen] = useState(false);
        const menuRef = useRef(null);
        const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 480);

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (menuRef.current && !menuRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };

            const handleResize = () => {
                setIsSmallScreen(window.innerWidth <= 480);
                if (window.innerWidth <= 480) {
                    setIsOpen(false); // Close menu on resize to avoid positioning issues
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', handleResize);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('resize', handleResize);
            };
        }, []);

        return (
            <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isSmallScreen ? 4 : 7,
                        padding: isSmallScreen ? '3px 8px' : '3px 10px',
                        border: '1px solid #3A3530',
                        borderRadius: 20,
                        fontSize: isSmallScreen ? 10 : 11,
                        fontWeight: 500,
                        background: 'transparent',
                        color: '#F5F0E8',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <div style={{
                        width: isSmallScreen ? 20 : 24,
                        height: isSmallScreen ? 20 : 24,
                        borderRadius: '50%',
                        background: user.role === 'admin' ? '#185FA5' : user.role === 'staff' ? '#4A6741' : '#C4522A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isSmallScreen ? 8 : 9,
                        fontWeight: 700,
                        color: '#fff'
                    }}>
                        {user.initials}
                    </div>
                    {!isSmallScreen && (
                        <>
                            <span style={{ display: 'inline-block' }}>{user.name}</span>
                            <span style={{ fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                        </>
                    )}
                    {isSmallScreen && (
                        <span style={{ fontSize: 12 }}>☰</span>
                    )}
                </button>

                {isOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 'auto',
                        bottom: isSmallScreen ? 0 : 'auto',
                        left: isSmallScreen ? 0 : 'auto',
                        right: isSmallScreen ? 0 : 0,
                        marginTop: isSmallScreen ? 0 : 8,
                        background: '#2D2520',
                        borderRadius: isSmallScreen ? '16px 16px 0 0' : '12px',
                        minWidth: isSmallScreen ? '100%' : '200px',
                        maxWidth: isSmallScreen ? '100%' : '280px',
                        width: isSmallScreen ? '100%' : 'auto',
                        boxShadow: isSmallScreen ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.2)',
                        zIndex: 9999,
                        overflow: 'hidden',
                        animation: isSmallScreen ? 'slideUp 0.3s ease' : 'fadeUp 0.2s ease'
                    }}>
                        {/* Drag handle for mobile */}
                        {isSmallScreen && (
                            <div
                                style={{
                                    width: 40,
                                    height: 4,
                                    background: '#4A4030',
                                    borderRadius: 2,
                                    margin: '12px auto 8px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setIsOpen(false)}
                            />
                        )}

                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3A3530' }}>
                            <div style={{ fontSize: isSmallScreen ? 14 : 12, fontWeight: 600, color: '#F5F0E8' }}>
                                {user.name}
                            </div>
                            <div style={{ fontSize: isSmallScreen ? 11 : 10, color: '#6A6050', marginTop: 2 }}>
                                {user.role === 'student' ? 'Student' : user.role === 'staff' ? 'Staff Member' : 'Administrator'}
                            </div>
                            {isSmallScreen && user.id && (
                                <div style={{ fontSize: 10, color: '#4A4030', marginTop: 4 }}>
                                    ID: {user.id}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onSettings();
                            }}
                            style={{
                                width: '100%',
                                padding: isSmallScreen ? '14px 16px' : '10px 16px',
                                textAlign: 'left',
                                background: 'transparent',
                                color: '#F5F0E8',
                                fontSize: isSmallScreen ? 14 : 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                transition: 'background .15s',
                                cursor: 'pointer',
                                border: 'none'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#3A3530'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: isSmallScreen ? 18 : 14 }}>⚙️</span>
                            <span>Settings</span>
                        </button>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onLogout();
                            }}
                            style={{
                                width: '100%',
                                padding: isSmallScreen ? '14px 16px' : '10px 16px',
                                textAlign: 'left',
                                background: 'transparent',
                                color: '#E8693D',
                                fontSize: isSmallScreen ? 14 : 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                borderTop: '1px solid #3A3530',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#3A3530'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: isSmallScreen ? 18 : 14 }}>🚪</span>
                            <span>Sign Out</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }
    function UserManagementPage() {
        const { showToast } = useContext(AppCtx);
        const [users, setUsers] = useState([]);
        const [loading, setLoading] = useState(true);
        const [showAddModal, setShowAddModal] = useState(false);
        const [showEditModal, setShowEditModal] = useState(false);
        const [selectedUser, setSelectedUser] = useState(null);
        const [formData, setFormData] = useState({
            name: '',
            email: '',
            reg_number: '',
            role: 'staff'
        });
        const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

        useEffect(() => {
            const handleResize = () => {
                setIsMobile(window.innerWidth <= 768);
            };
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }, []);

        const generatePassword = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
            let password = '';
            for (let i = 0; i < 10; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        };

        const loadUsers = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:5000/api/users?role=staff', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                if (result.success && result.users) {
                    const staffUsers = result.users.filter(user => user.role === 'staff');
                    setUsers(staffUsers);
                } else {
                    setUsers([
                        { id: 2, name: 'Mary K.', email: 'mary@unieat.com', reg_number: 'STAFF001', role: 'staff', is_active: true, created_at: '2024-01-15' },
                        { id: 4, name: 'James Otieno', email: 'james@unieat.com', reg_number: 'STAFF002', role: 'staff', is_active: true, created_at: '2024-02-20' },
                        { id: 5, name: 'Grace Mwangi', email: 'grace@unieat.com', reg_number: 'STAFF003', role: 'staff', is_active: false, created_at: '2024-03-10' },
                    ]);
                }
            } catch (error) {
                console.error('Failed to load users:', error);
                setUsers([
                    { id: 2, name: 'Mary K.', email: 'mary@unieat.com', reg_number: 'STAFF001', role: 'staff', is_active: true, created_at: '2024-01-15' },
                    { id: 4, name: 'James Otieno', email: 'james@unieat.com', reg_number: 'STAFF002', role: 'staff', is_active: true, created_at: '2024-02-20' },
                    { id: 5, name: 'Grace Mwangi', email: 'grace@unieat.com', reg_number: 'STAFF003', role: 'staff', is_active: false, created_at: '2024-03-10' },
                ]);
            }
            setLoading(false);
        };

        useEffect(() => {
            loadUsers();
        }, []);

        const handleAddUser = async () => {
            if (!formData.name || !formData.email || !formData.reg_number) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            const newPassword = generatePassword();

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:5000/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        ...formData,
                        role: 'staff',
                        password: newPassword
                    })
                });
                const result = await response.json();

                if (result.success) {
                    await loadUsers();
                    setShowAddModal(false);
                    setFormData({ name: '', email: '', reg_number: '', role: 'staff' });
                    showToast(`Staff member added!`, 'success');
                    alert(`Staff account created successfully!\n\nName: ${formData.name}\nUsername: ${formData.reg_number}\nPassword: ${newPassword}\n\nPlease share these credentials with the staff member.`);
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                const newUser = {
                    id: Date.now(),
                    ...formData,
                    role: 'staff',
                    is_active: true,
                    created_at: new Date().toISOString()
                };
                setUsers(prev => [...prev, newUser]);
                setShowAddModal(false);
                setFormData({ name: '', email: '', reg_number: '', role: 'staff' });
                showToast(`Staff added (demo mode)`, 'success');
                alert(`Demo mode - Staff created!\n\nName: ${formData.name}\nUsername: ${formData.reg_number}\nPassword: ${newPassword}`);
            }
        };

        const handleEditUser = async () => {
            if (!selectedUser) return;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        ...formData,
                        role: 'staff'
                    })
                });
                const result = await response.json();

                if (result.success) {
                    await loadUsers();
                    setShowEditModal(false);
                    setSelectedUser(null);
                    setFormData({ name: '', email: '', reg_number: '', role: 'staff' });
                    showToast('Staff member updated successfully', 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                setUsers(prev => prev.map(u =>
                    u.id === selectedUser.id ? { ...u, ...formData, role: 'staff' } : u
                ));
                setShowEditModal(false);
                setSelectedUser(null);
                showToast('Staff updated (demo mode)', 'success');
            }
        };

        const handleDeleteUser = async (user) => {
            if (!confirm(`Are you sure you want to delete staff member ${user.name}?`)) return;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/users/${user.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();

                if (result.success) {
                    await loadUsers();
                    showToast('Staff member deleted successfully', 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                setUsers(prev => prev.filter(u => u.id !== user.id));
                showToast('Staff deleted (demo mode)', 'success');
            }
        };

        const handleToggleStatus = async (user) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/users/${user.id}/toggle-status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ is_active: !user.is_active })
                });
                const result = await response.json();

                if (result.success) {
                    await loadUsers();
                    showToast(`Staff ${user.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                setUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, is_active: !u.is_active } : u
                ));
                showToast(`Staff ${user.is_active ? 'deactivated' : 'activated'} (demo mode)`, 'success');
            }
        };

        const handleResetPassword = async (user) => {
            const newPassword = generatePassword();

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/users/${user.id}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ newPassword })
                });
                const result = await response.json();

                if (result.success) {
                    showToast(`Password reset for ${user.name}`, 'success');
                    alert(`Password reset for staff member\n\nName: ${user.name}\nUsername: ${user.reg_number}\nNew Password: ${newPassword}\n\nPlease share this with the staff member.`);
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showToast(`Demo mode - New password would be: ${newPassword}`, 'success');
                alert(`Demo mode - Password reset for ${user.name}\n\nNew Password: ${newPassword}`);
            }
        };

        if (loading) {
            return (
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: '#C4522A', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin .7s linear infinite' }}></div>
                    <div>Loading staff members...</div>
                </div>
            );
        }

        return (
            <div style={{ padding: isMobile ? 16 : 24, overflowY: 'auto', animation: 'fadeIn .25s ease' }}>
                {/* Header Section - Responsive */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? 16 : 0,
                    marginBottom: 24
                }}>
                    <div>
                        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isMobile ? 20 : 24, marginBottom: 4 }}>
                            Staff Management
                        </div>
                        <div style={{ fontSize: isMobile ? 11 : 13, color: 'var(--muted)' }}>
                            Manage canteen staff accounts (view, add, edit, delete)
                        </div>
                    </div>
                    <Btn variant="rust" onClick={() => setShowAddModal(true)} small={isMobile}>
                        + Add Staff Member
                    </Btn>
                </div>

                {/* Statistics Cards - Responsive Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
                    gap: 12,
                    marginBottom: 20
                }}>
                    <StatCard label="Total Staff" value={users.length} color="sage" icon="👥" />
                    <StatCard label="Active Staff" value={users.filter(u => u.is_active !== false).length} color="rust" icon="✅" />
                    <StatCard label="Inactive Staff" value={users.filter(u => u.is_active === false).length} color="amber" icon="⏸️" />
                </div>

                {/* Staff Users Table - Responsive (Card layout on mobile) */}
                {isMobile ? (
                    // Mobile Card View
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {users.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--muted)' }}>
                                No staff members found. Click "Add Staff Member" to create one.
                            </div>
                        ) : (
                            users.map((user) => (
                                <div key={user.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{user.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email || '—'}</div>
                                        </div>
                                        <Badge color={user.is_active !== false ? 'sage' : 'red'}>
                                            {user.is_active !== false ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Staff ID</div>
                                            <Badge color="sage">{user.reg_number}</Badge>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Joined</div>
                                            <div style={{ fontSize: 12 }}>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => handleToggleStatus(user)}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                border: '1px solid var(--border)',
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                background: user.is_active !== false ? '#FEF3DC' : '#EAF0E8',
                                                color: user.is_active !== false ? '#854F0B' : '#4A6741'
                                            }}
                                        >
                                            {user.is_active !== false ? '🔴 Deactivate' : '🟢 Activate'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setFormData({
                                                    name: user.name,
                                                    email: user.email || '',
                                                    reg_number: user.reg_number,
                                                    role: 'staff'
                                                });
                                                setShowEditModal(true);
                                            }}
                                            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, background: '#fff' }}
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => handleResetPassword(user)}
                                            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, background: '#fff' }}
                                        >
                                            🔑 Reset PW
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            style={{ flex: 1, padding: '8px 12px', border: '1px solid #A32D2D', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#A32D2D', background: '#fff' }}
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // Desktop Table View
                    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--tag)' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Staff Name</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Email</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Staff ID</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Joined</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                            No staff members found. Click "Add Staff Member" to create one.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user, index) => (
                                        <tr key={user.id} style={{ borderTop: '1px solid var(--border)', background: index % 2 === 0 ? '#fff' : '#FAFAF7' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 500 }}>{user.name}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{user.email || '—'}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                                <Badge color="sage">{user.reg_number}</Badge>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <Badge color={user.is_active !== false ? 'sage' : 'red'}>
                                                    {user.is_active !== false ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => handleToggleStatus(user)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 6,
                                                            cursor: 'pointer',
                                                            fontSize: 11,
                                                            background: user.is_active !== false ? '#FEF3DC' : '#EAF0E8',
                                                            color: user.is_active !== false ? '#854F0B' : '#4A6741'
                                                        }}
                                                    >
                                                        {user.is_active !== false ? '🔴 Deactivate' : '🟢 Activate'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setFormData({
                                                                name: user.name,
                                                                email: user.email || '',
                                                                reg_number: user.reg_number,
                                                                role: 'staff'
                                                            });
                                                            setShowEditModal(true);
                                                        }}
                                                        style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleResetPassword(user)}
                                                        style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                                                    >
                                                        🔑 Reset PW
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        style={{ padding: '4px 8px', border: '1px solid #A32D2D', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#A32D2D' }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Add Staff Modal - Responsive */}
                <Modal open={showAddModal} onClose={() => setShowAddModal(false)} maxW={isMobile ? '95%' : 500} center>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 20 }}>
                        Add New Staff Member
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Full Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                            placeholder="e.g., Sarah Johnson"
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Email *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                            placeholder="staff@unieat.com"
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Staff ID *
                        </label>
                        <input
                            type="text"
                            value={formData.reg_number}
                            onChange={e => setFormData({ ...formData, reg_number: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                            placeholder="STAFF002"
                        />
                    </div>
                    <div style={{ padding: 12, background: 'var(--infobg)', borderRadius: 8, marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: 'var(--info)', marginBottom: 4 }}>🔐 Auto-generated password</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>A secure password will be generated automatically. You'll be able to share it with the staff member after creation.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                        <Btn fullWidth variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Btn>
                        <Btn fullWidth variant="rust" onClick={handleAddUser}>Add Staff Member</Btn>
                    </div>
                </Modal>

                {/* Edit Staff Modal - Responsive */}
                <Modal open={showEditModal} onClose={() => setShowEditModal(false)} maxW={isMobile ? '95%' : 500} center>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: isMobile ? 18 : 20, marginBottom: 20 }}>
                        Edit Staff Member
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                        />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
                            Staff ID
                        </label>
                        <input
                            type="text"
                            value={formData.reg_number}
                            onChange={e => setFormData({ ...formData, reg_number: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: isMobile ? 13 : 14 }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                        <Btn fullWidth variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Btn>
                        <Btn fullWidth variant="rust" onClick={handleEditUser}>Save Changes</Btn>
                    </div>
                </Modal>
            </div>
        );
    }
    function App() {
        const [user, setUser] = useState(null);
        const [page, setPage] = useState('');
        const [cart, setCart] = useState({});
        const [toast, showToast] = useToast();

        const handleLogin = (u) => {
            setUser(u);
            setPage(u.role==='student'?'menu':u.role==='staff'?'scanner':'dashboard');
        };

        const handleLogout = () => {
            setUser(null);
            setPage('');
            setCart({});
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        };

        const handleUpdateUser = (updatedUser) => {
            setUser(updatedUser);
        };

        const handleOpenSettings = () => {
            setPage('settings');
        };

        if (!user) return (<AppCtx.Provider value={{showToast}}><LoginScreen onLogin={handleLogin}/><Toast toast={toast}/></AppCtx.Provider>);

        const renderPage = () => {
            if (user.role==='student') {
                if (page==='menu') return <MenuPage cart={cart} setCart={setCart} setPage={setPage}/>;
                if (page==='orders') return <OrdersPage/>;
            }
            if (user.role==='staff') {
                if (page==='scanner') return <ScannerPage/>;
                if (page==='queue') return <QueuePage/>;
            }
            if (user.role==='admin') {
                if (page==='dashboard') return <DashboardPage/>;
                if (page==='menu-mgmt') return <MenuMgmtPage/>;
                if (page==='orders-mgmt') return <OrdersMgmtPage/>;
                if (page === 'users') return <UserManagementPage/>;
                if (page==='reports') return <ReportsPage/>;
            }
            if (page==='settings') return <SettingsPage user={user} onUpdateUser={handleUpdateUser} />;
            return <div>404</div>;
        };

        return (
            <AppCtx.Provider value={{showToast}}>
                <div style={{height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
                    <TopBar
                        page={page}
                        setPage={setPage}
                        user={user}
                        cart={cart}
                        onLogout={handleLogout}
                        onSettings={handleOpenSettings}
                    />
                    <div style={{flex:1,overflow:'auto'}}>
                        {renderPage()}
                    </div>
                </div>
                <Toast toast={toast}/>
            </AppCtx.Provider>
        );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App/>);