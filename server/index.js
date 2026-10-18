import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { z } from 'zod';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { branch, openDatabase, token, hash, passwordHash, passwordMatches, validateLocation } from './core.js';

export function createApp(folder = resolve(process.env.DATA_DIR || './data')) {
  const db = openDatabase(folder), app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}); next(); });
  app.use(express.json({limit:'32kb'}));
  app.use('/api', rateLimit({ windowMs:60000, limit:180, standardHeaders:'draft-8', legacyHeaders:false }));
  const loginLimit = rateLimit({ windowMs:15*60000, limit:20, standardHeaders:'draft-8', legacyHeaders:false });
  const locationSchema = z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(10000),timestamp:z.number().int().positive(),mocked:z.boolean().default(false)});
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const auth = (req, _res, next) => {
    const raw = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const user = raw && db.prepare('SELECT u.id,u.name,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1').get(hash(raw), Date.now());
    if (!user) return next(fail(401,'Oturum geçersiz veya süresi dolmuş. Tekrar giriş yap.'));
    req.user = user; next();
  };
  const roles = (...allowed) => (req, _res, next) => allowed.includes(req.user.role) ? next() : next(fail(403,'Bu işlem için yetkin yok.'));
  const upload = multer({ storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:1,fields:5,parts:6} });
  app.post('/api/login', loginLimit, (req,res) => {
    const { username, password } = z.object({username:z.string().min(1).max(50),password:z.string().min(1).max(200)}).parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
    // Equalize unknown-user and wrong-password work.
    const check = u?.password || dummyPassword;
    if (!passwordMatches(password,check) || !u) throw fail(401,'Kullanıcı adı veya şifre yanlış.');
    const raw = token(); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw),u.id,Date.now()+12*60*60000);
    res.json({token:raw,user:{id:u.id,name:u.name,username:u.username,role:u.role}});
  });
  app.post('/api/logout',auth,(req,res) => {db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(req.headers.authorization.slice(7)));res.json({ok:true});});
  app.get('/api/me',auth,(req,res) => {
    const rows = db.prepare('SELECT id,kind,created,distance FROM attendance WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id);
    res.json({user:req.user,branch,active:rows[0]?.kind==='in',records:rows});
  });
  app.post('/api/kiosk/qr',auth,roles('kiosk','admin'),async(req,res) => {
    const raw=token(),now=Date.now(),expires=now+30000;
    db.prepare('DELETE FROM challenges WHERE expires<?').run(now-120000);
    db.prepare('INSERT INTO challenges VALUES(?,?,?)').run(hash(raw),req.user.id,expires);
    res.json({image:await QRCode.toDataURL('personeltakip:'+raw,{width:420,margin:2}),expires,serverTime:now,branch});
  });
  app.post('/api/attendance/prepare',auth,roles('employee','admin'),(req,res) => {
    const body=z.object({qr:z.string().regex(/^personeltakip:[a-f0-9]{64}$/),location:locationSchema}).parse(req.body);
    const now=Date.now(),challengeHash=hash(body.qr.slice('personeltakip:'.length));
    const qr=db.prepare('SELECT c.* FROM challenges c JOIN users u ON u.id=c.kiosk_id WHERE c.token_hash=? AND u.active=1').get(challengeHash);
    if(!qr || qr.expires<=now) throw fail(400,'QR geçersiz veya süresi dolmuş. Yeni QR okut.');
    validateLocation(body.location,now);
    if(db.prepare('SELECT 1 FROM attempts WHERE user_id=? AND challenge_hash=?').get(req.user.id,challengeHash)) throw fail(409,'Bu QR ile işlem başlatıldı. Yeni QR okut.');
    const raw=token();db.prepare('INSERT INTO attempts(token_hash,user_id,challenge_hash,expires) VALUES(?,?,?,?)').run(hash(raw),req.user.id,challengeHash,now+90000);
    res.json({attempt:raw,expires:now+90000});
  });
  app.post('/api/attendance',auth,roles('employee','admin'),upload.single('photo'),async(req,res) => {
    const body=z.object({attempt:z.string().regex(/^[a-f0-9]{64}$/),requestKey:z.string().uuid(),kind:z.enum(['in','out']),location:z.string().max(1000)}).parse(req.body);
    const prior=db.prepare('SELECT id,kind,created,attempt_hash FROM attendance WHERE user_id=? AND request_key=?').get(req.user.id,body.requestKey);
    if(prior){if(prior.attempt_hash!==hash(body.attempt)||prior.kind!==body.kind) throw fail(409,'İstek anahtarı başka bir işlemde kullanılmış.');return res.json({id:prior.id,kind:prior.kind,created:prior.created,replayed:true});}
    if(!req.file) throw fail(400,'Anlık fotoğraf gerekli.');
    let location;try{location=locationSchema.parse(JSON.parse(body.location));}catch{throw fail(400,'Konum bilgisi geçersiz.');}
    const meters=validateLocation(location);
    let photo;
    try { photo=await sharp(req.file.buffer,{limitInputPixels:20000000}).rotate().resize(900,900,{fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toBuffer(); }
    catch {throw fail(400,'Geçerli bir fotoğraf gönder.');}
    const now=Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const replay=db.prepare('SELECT id,kind,created FROM attendance WHERE user_id=? AND request_key=?').get(req.user.id,body.requestKey);
      if(replay){db.exec('COMMIT');return res.json({...replay,replayed:true});}
      const attempt=db.prepare('SELECT * FROM attempts WHERE token_hash=? AND user_id=?').get(hash(body.attempt),req.user.id);
      if(!attempt || attempt.expires<=now || attempt.consumed) throw fail(400,'Doğrulama süresi dolmuş. Yeniden QR okut.');
      const latest=db.prepare('SELECT kind,created FROM attendance WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
      if((latest?.kind==='in'?'out':'in')!==body.kind) throw fail(409,'Mesai durumun değişmiş. Ekranı yenileyip tekrar dene.');
      if(latest && now-latest.created<30000) throw fail(409,'İki mesai işlemi arasında en az 30 saniye olmalı.');
      const result=db.prepare('INSERT INTO attendance(user_id,kind,created,photo,latitude,longitude,accuracy,distance,request_key,attempt_hash) VALUES(?,?,?,?,?,?,?,?,?,?)').run(req.user.id,body.kind,now,photo,location.latitude,location.longitude,location.accuracy,meters,body.requestKey,hash(body.attempt));
      db.prepare('UPDATE attempts SET consumed=1 WHERE token_hash=?').run(hash(body.attempt));
      db.prepare('INSERT INTO audit(actor,action,created) VALUES(?,?,?)').run(req.user.id,'attendance:'+result.lastInsertRowid,now);
      db.exec('COMMIT');res.status(201).json({id:Number(result.lastInsertRowid),kind:body.kind,created:now});
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.get('/api/admin/users',auth,roles('admin'),(_req,res)=>res.json(db.prepare('SELECT id,username,name,role,active FROM users ORDER BY id').all()));
  app.post('/api/admin/users',auth,roles('admin'),(req,res)=>{
    const u=z.object({username:z.string().regex(/^[a-zA-Z0-9_.-]{3,50}$/),name:z.string().min(2).max(100),password:z.string().min(12).max(200),role:z.enum(['employee','kiosk'])}).parse(req.body);
    if(db.prepare('SELECT 1 FROM users WHERE username=?').get(u.username))throw fail(409,'Bu kullanıcı adı zaten var.');
    const result=db.prepare('INSERT INTO users(username,name,password,role) VALUES(?,?,?,?)').run(u.username,u.name,passwordHash(u.password),u.role);
    db.prepare('INSERT INTO audit(actor,action,created) VALUES(?,?,?)').run(req.user.id,'create_user:'+result.lastInsertRowid,Date.now());res.status(201).json({id:Number(result.lastInsertRowid)});
  });
  app.get('/api/admin/attendance',auth,roles('admin'),(_req,res)=>res.json(db.prepare('SELECT a.id,u.name,a.kind,a.created,a.distance,a.accuracy FROM attendance a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200').all()));
  app.get('/api/admin/photos/:id',auth,roles('admin'),(req,res)=>{
    const row=db.prepare('SELECT photo FROM attendance WHERE id=?').get(req.params.id);if(!row)throw fail(404,'Kayıt yok.');res.type('jpeg').send(Buffer.from(row.photo));
  });
  app.use(express.static(resolve(dirname(fileURLToPath(import.meta.url)),'public'),{etag:false}));
  app.use((err,_req,res,_next)=>{const validation=err instanceof z.ZodError;const status=validation?400:err instanceof multer.MulterError?400:err.status||500;res.status(status).json({error:validation?'Gönderilen alanları kontrol et.':status===500?'Sunucu işlemi tamamlayamadı.':err.message});});
  return {app,db};
}
const dummyPassword=passwordHash('unknown-user-password');
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {app}=createApp();const port=Number(process.env.PORT||3001);
  app.listen(port,'0.0.0.0',()=>console.log('Atölye Ekip API ve kasa ekranı: http://localhost:'+port));
}
