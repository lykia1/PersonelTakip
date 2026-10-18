import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession, type Session } from '../context/SessionContext';

type Tab = 'Bugün' | 'Vardiya' | 'Geçmiş' | 'Profil';
type RecordEntry = {id:number;kind:'in'|'out';created:number;distance:number};
type Me = {active:boolean;records:RecordEntry[]};
const orange = '#FF743D';
const shifts = [['Pazartesi', '09:00 — 18:00'], ['Salı', '09:00 — 18:00'], ['Çarşamba', 'İzin günü'], ['Perşembe', '12:00 — 21:00'], ['Cuma', '12:00 — 21:00']];
function AppContent() {
  const [loginVisible,setLoginVisible] = useState(false);
  const {session,baseUrl,setBaseUrl,ready,storageError,saveSession,clearSession}=useSession();
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [connectionError,setConnectionError]=useState('');
  const [operationKind,setOperationKind]=useState<'in'|'out'>('in');
  const [progress,setProgress]=useState('');
  const submitLock=useRef(false);
  const [me,setMe] = useState<Me>();
  const [attempt,setAttempt] = useState('');
  const [requestKey,setRequestKey] = useState('');
  const [cameraReady,setCameraReady] = useState(false);
  const [submitted,setSubmitted] = useState(false);
  const generation = useRef(0);
  const params=useLocalSearchParams<{tab?:string}>();
  const tab:Tab=(['Bugün','Vardiya','Geçmiş','Profil'].includes(params.tab||'')?params.tab:'Bugün') as Tab;
  const setTab=(value:Tab)=>router.setParams({tab:value});
  const [stage, setStage] = useState<'closed' | 'qr' | 'selfie' | 'review'>('closed');
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const scanLock = useRef(false);
  const camera = useRef<CameraView>(null);
  const close = () => { generation.current++; setStage('closed'); setPhoto(undefined); setAttempt(''); setSubmitted(false);setProgress(''); scanLock.current = false; };
  async function api(path:string, body?:unknown, override?:Session) {
    const current=override||session;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(baseUrl.trim().replace(/\/$/,'')+'/api'+path,{signal:controller.signal,method:body?'POST':'GET',headers:{...(current?{Authorization:'Bearer '+current.token}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Bu adres mesai sunucusu değil. Sunucu adresinin :3001 ile bittiğini kontrol et.');
      const result=await response.json();
      if(!response.ok){const e=new Error(response.status===401?'Oturum süresi doldu. Hesabına yeniden giriş yap.':result.error||'İşlem tamamlanamadı.');throw e;}
      return result;
    }catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('Sunucu yanıt vermedi. Sunucunun açık olduğunu ve Wi-Fi bağlantını kontrol et.');throw e;}
    finally{clearTimeout(timeout);}
  }
  async function currentPosition(){
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Konum alınamadı. Hassas konumu açıp tekrar dene.')),20000);})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  async function refresh(current?:Session){if(current||session){setMe(await api('/me',undefined,current));setConnectionError('');}}
  useEffect(()=>{let cancelled=false;if(session)void api('/me').then(data=>{if(!cancelled){setMe(data);setConnectionError('');}}).catch((e)=>{if(!cancelled)setConnectionError(e instanceof Error?e.message:'Kayıtlar yenilenemedi.');});return()=>{cancelled=true;};},[tab,session]); // eslint-disable-line react-hooks/exhaustive-deps
  async function login(){
    if(busy)return;setBusy(true);
    try{
      if(!/^https?:\/\/[^/]+(?::\d+)?$/.test(baseUrl.trim()))throw new Error('Sunucu adresini http://192.168.1.123:3001 biçiminde gir.');
      if(!baseUrl.startsWith('https://')&&!__DEV__)throw new Error('Canlı kullanımda HTTPS sunucu adresi gerekli.');
      const result:Session=await api('/login',{username,password});
      if(!['admin','employee'].includes(result.user.role))throw new Error('Kasa hesabı mobil mesai için kullanılamaz.');
      await refresh(result);await saveSession(result);setPassword('');setLoginVisible(false);
    }catch(e){Alert.alert('Giriş yapılamadı',e instanceof Error?e.message:'Sunucuya bağlanılamadı.');}finally{setBusy(false);}
  }
  async function submit(){
    if(submitLock.current)return;
    if(!session){Alert.alert('Giriş gerekli','Mesai kaydetmek için hesabına giriş yap.');close();setLoginVisible(true);return;}
    if(!photo||!attempt){Alert.alert('QR doğrulaması gerekli','Mesai işlemini yeniden QR okutarak başlat.');close();return;}
    submitLock.current=true;setBusy(true);setProgress('Güncel konum kontrol ediliyor…');
    try{
      const position=await currentPosition();
      const form=new FormData();form.append('attempt',attempt);form.append('requestKey',requestKey);form.append('kind',operationKind);
      form.append('location',JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy??10000,timestamp:position.timestamp,mocked:position.mocked??false}));
      form.append('photo',{uri:photo,name:'attendance.jpg',type:'image/jpeg'} as unknown as Blob);
      setProgress('Fotoğraf ve mesai kaydı gönderiliyor…');
      const saved=await api('/attendance',form);setSubmitted(true);
      setMe(previous=>({active:saved.kind==='in',records:[{id:saved.id,kind:saved.kind,created:saved.created,distance:0},...(previous?.records||[]).filter(r=>r.id!==saved.id)]}));
      Alert.alert(saved.kind==='in'?'Mesain başladı':'Mesain tamamlandı','Fotoğrafın ve mesai kaydın sunucuya kaydedildi.');
      void refresh().catch(()=>setConnectionError('Kayıt alındı; geçmiş henüz yenilenemedi.'));
    }catch(e){Alert.alert('Mesai kaydedilemedi',e instanceof Error?e.message:'Bağlantıyı kontrol et.');}finally{submitLock.current=false;setBusy(false);setProgress('');}
  }

  async function start() {
    if(!ready||busy)return;
    if(!session){setLoginVisible(true);return;}
    try {
      const latest:Me=await api('/me');setMe(latest);setOperationKind(latest.active?'out':'in');
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) return Alert.alert('Kamera izni gerekli', 'QR ve anlık fotoğraf için kamera iznini açmalısın.');
      setCameraReady(false);scanLock.current = false; setStage('qr');
    } catch (e) { Alert.alert('Mesai başlatılamadı', e instanceof Error?e.message:'Bağlantıyı ve kamera iznini kontrol et.'); }
  }
  async function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true; setBusy(true);const currentGeneration=generation.current;
    try {
      if (!data.startsWith('personeltakip:')) throw new Error('Bu bir PersonelTakip QR kodu değil.');
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.granted) throw new Error('Devam etmek için konum izni gerekli.');
      const position = await currentPosition();
      if (position.mocked) throw new Error('Sahte konum ile işlem yapılamaz.');
      if(currentGeneration!==generation.current)return;
      if(session){const prepared=await api('/attendance/prepare',{qr:data,location:{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy??10000,timestamp:position.timestamp,mocked:position.mocked??false}});if(currentGeneration!==generation.current)return;setAttempt(prepared.attempt);setRequestKey(Crypto.randomUUID());}
      setCameraReady(false);setStage('selfie');
    } catch (e) { Alert.alert('İşlem tamamlanamadı', e instanceof Error ? e.message : 'Konum alınamadı. Tekrar dene.'); scanLock.current = false; }
    finally { setBusy(false); }
  }
  async function capture() {
    if (busy||!cameraReady) return; setBusy(true);
    try {
      const result = await camera.current?.takePictureAsync({ quality: 0.6 });
      if (!result) throw new Error();
      setPhoto(result.uri); setStage('review');
    } catch { Alert.alert('Fotoğraf çekilemedi', 'Tekrar deneyebilirsin.'); }
    finally { setBusy(false); }
  }
  const row = (label: string, value: string) => <View key={label} style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.white}>{value}</Text></View>;
  if(!ready)return <SafeAreaView style={s.screen}><Text style={[s.muted,{padding:30}]}>Oturum yükleniyor…</Text></SafeAreaView>;
  return <SafeAreaView style={s.screen}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}><View style={s.brandMark}><Ionicons name="layers" size={23} color={orange}/></View><View style={{ flex: 1 }}><Text style={s.brand}>ATÖLYE <Text style={{ color: orange }}>EKİP</Text></Text><Text style={s.small}>DÖNER ATÖLYESİ · PERSONEL</Text></View><View style={s.avatar}><Text style={s.white}>DA</Text></View></View>
      <Pressable style={s.demo} onPress={()=>!session&&setLoginVisible(true)}><View style={s.dot}/><Text style={s.demoText}>{session ? session.user.name+' · SUNUCUYA BAĞLI' : 'ÖNİZLEME · Gerçek hesabınla giriş yap →'}</Text></Pressable>
      {storageError&&<Text style={s.hint}>{storageError}</Text>}
      {!!connectionError&&<Pressable onPress={()=>setLoginVisible(true)}><Text style={[s.hint,{color:orange,marginBottom:18}]}>{connectionError} · Hesabıma bağlan</Text></Pressable>}
      <Text style={s.eyebrow}>BİRLİKTE DAHA GÜÇLÜ</Text>
      <Text style={s.title}>{tab === 'Bugün' ? 'Güzel bir güne\nbaşlayalım.' : tab === 'Vardiya' ? 'Haftanı\nplanla.' : tab === 'Geçmiş' ? 'Emeğinin\nkaydı burada.' : 'Senin\nçalışma alanın.'}</Text>
      {tab === 'Bugün' && <>
        <View style={s.hero}><View style={s.row}><Text style={s.heroLabel}>BUGÜNKÜ VARDİYAN</Text><View style={s.badge}><Text style={s.badgeText}>{session ? 'Mesai' : 'Planlandı'}</Text></View></View><Text style={s.hours}>{session ? (me?.active?'Mesaidesin':'Hazır mısın?') : '09:00 — 18:00'}</Text><Text style={s.muted}>Merkez Şube  ·  Servis ekibi</Text><View style={s.divider}/><View style={s.row}><Text style={s.muted}>Mesai durumu</Text><Text style={s.white}>{me?.active?'Devam ediyor':'Henüz başlamadı'}</Text></View><Pressable accessibilityRole="button" style={s.primary} onPress={start}><Ionicons name="qr-code-outline" color="#17191F" size={24}/><Text style={s.primaryText}>{me?.active?'QR ile mesai bitir':'QR ile mesai başlat'}</Text><Ionicons name="arrow-forward" size={21}/></Pressable><Text style={s.hint}>QR okut · Konum paylaş · Anlık fotoğraf çek</Text></View>
        <View style={s.section}><Text style={s.sectionTitle}>{session?'Son kayıtların':'Bu ay nasıl gidiyor?'}</Text><Text style={s.orange}>{session?'Gerçek kayıtlar':'Örnek özet'}</Text></View>
        {session ? <View style={s.hero}>{(me?.records||[]).slice(0,3).map(r=>row(new Date(r.created).toLocaleString('tr-TR'),r.kind==='in'?'Giriş':'Çıkış'))}{!me?.records.length&&<Text style={s.muted}>Henüz mesai kaydı yok.</Text>}</View> : <View style={s.stats}><View style={s.stat}><Ionicons name="time-outline" size={24} color={orange}/><Text style={s.statValue}>128 <Text style={s.unit}>sa</Text></Text><Text style={s.muted}>Çalışma süresi</Text></View><View style={s.stat}><Ionicons name="calendar-outline" size={24} color={orange}/><Text style={s.statValue}>16 <Text style={s.unit}>gün</Text></Text><Text style={s.muted}>Katılım</Text></View></View>}
        <View style={s.notice}><Ionicons name="sparkles-outline" size={24} color={orange}/><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Her emek değerli.</Text><Text style={[s.muted, { marginTop: 8, lineHeight: 22 }]}>Vardiyalarını ve çalışma kayıtlarını tek bir yerden takip et.</Text></View></View>
      </>}
      {tab === 'Vardiya' && <View style={s.hero}><Text style={s.sectionTitle}>{session?'Vardiyalar':'Örnek haftalık plan'}</Text>{!session&&shifts.map(([day,time]) => row(day,time))}<Text style={s.hint}>Vardiya planlama modülü henüz hazır değil.</Text></View>}
      {tab === 'Geçmiş' && <View style={s.hero}><Text style={s.sectionTitle}>{session?'Mesai kayıtların':'Örnek mesai kayıtları'}</Text>{session ? (me?.records||[]).map(r=>row(new Date(r.created).toLocaleString('tr-TR'),r.kind==='in'?'Giriş':'Çıkış')) : row('16 Ekim · Cuma','09:02 — 18:00')}{session&&!me?.records.length&&<Text style={s.hint}>Henüz kayıt yok.</Text>}</View>}
      {tab === 'Profil' && <View style={s.hero}><Text style={s.sectionTitle}>Personel hesabı</Text>{row('İşletme','Döner Atölyesi')}{row('Şube','Merkez')}{row('Oturum',session?.user.name||'Önizleme')}<Text style={[s.muted,{lineHeight:23}]}>Mesai sırasında fotoğraf, saat ve konum sunucuya kaydedilir. Fotoğrafı yönetici inceler; otomatik yüz doğrulaması yapılmaz. İzin ve performans modülleri sonraki aşamadadır.</Text><Pressable style={s.primary} onPress={async()=>{if(session){try{await api('/logout',{});}catch{Alert.alert('Bağlantı hatası','Sunucudan çıkış yapılamadı. Tekrar dene.');return;}await clearSession();setMe(undefined);setConnectionError('');}else setLoginVisible(true);}}><Text style={s.primaryText}>{session?'Çıkış yap':'Hesabıma giriş yap'}</Text></Pressable></View>}
      <Text style={s.footer}>ATÖLYE EKİP / İNSAN ODAKLI ÇALIŞMA</Text>
    </ScrollView>
    <View style={s.nav}>{(['Bugün','Vardiya','Geçmiş','Profil'] as Tab[]).map((item,i) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={s.navItem}><Ionicons name={(['grid-outline','calendar-outline','time-outline','person-outline'] as const)[i]} size={23} color={tab === item ? orange : '#858995'}/><Text style={[s.navLabel, tab === item && { color: orange }]}>{item}</Text></Pressable>)}</View>
    <Modal visible={stage !== 'closed'} animationType="slide" onRequestClose={()=>!busy&&close()}><SafeAreaProvider><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Pressable disabled={busy} onPress={close} accessibilityLabel="Kapat"><Text style={s.orange}>✕  Kapat</Text></Pressable><Text style={s.title}>{stage === 'qr' ? 'Kasadaki QR’ı okut.' : stage === 'selfie' ? 'Anlık fotoğrafını çek.' : 'Fotoğraf hazır.'}</Text><Text style={[s.muted,{ marginBottom: 20, lineHeight: 22 }]}>{stage === 'qr' ? (session?'Kasadaki güncel QR kodunu okut. Konum sunucuda kontrol edilir.':'Önizleme: personeltakip:test QR kodu kullanılabilir. Gerçek kayıt için hesabına giriş yap.') : stage === 'selfie' ? 'Yüzünü çerçevenin ortasına getir. Bu adım otomatik yüz tanıma yapmaz.' : (session?(submitted?'Mesai kaydın alındı.':'Fotoğrafı kontrol edip mesai kaydını onayla.'):'Önizleme: gerçek mesai kaydı oluşturulmaz.')}</Text>
      {stage === 'qr' && <CameraView style={s.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : ({data}) => void scan(data)}/>}
      {stage === 'selfie' && <><CameraView key="selfie" ref={camera} onCameraReady={()=>setCameraReady(true)} style={s.camera} facing="front"/><Pressable disabled={busy||!cameraReady} style={s.primary} onPress={capture}><Text style={s.primaryText}>{busy ? 'Çekiliyor…' : 'Fotoğraf çek'}</Text></Pressable></>}
      {stage === 'review' && <>{photo && <Image source={{ uri: photo }} style={s.camera}/>}<Pressable style={s.primary} disabled={busy} onPress={session&&!submitted?submit:close}><Text style={s.primaryText}>{busy?'Kaydediliyor…':session?(submitted?'Tamam':'Mesai kaydını onayla'):'Önizlemeyi tamamla'}</Text></Pressable></>}
      {busy && stage === 'qr' && <Text style={s.hint}>Konum alınıyor…</Text>}
      {!!progress&&<Text style={s.hint}>{progress}</Text>}
    </ScrollView></SafeAreaView></SafeAreaProvider></Modal>
    <Modal visible={loginVisible} animationType="slide" onRequestClose={()=>!busy&&setLoginVisible(false)}><SafeAreaProvider><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Pressable disabled={busy} onPress={()=>setLoginVisible(false)}><Text style={s.orange}>✕ Kapat</Text></Pressable><Text style={s.title}>Ekibine bağlan.</Text><Text style={s.muted}>İşletmenin sunucu adresi ve sana verilen hesapla giriş yap.</Text>{[['Sunucu adresi',baseUrl,setBaseUrl],['Kullanıcı adı',username,setUsername],['Şifre',password,setPassword]].map(([label,value,setter],i)=><View key={String(label)} style={{marginTop:22}}><Text style={s.muted}>{String(label)}</Text><TextInput style={s.input} value={String(value)} onChangeText={setter as (v:string)=>void} secureTextEntry={i===2} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder={i===0?'http://192.168.1.123:3001':''} placeholderTextColor="#757B89"/></View>)}<Pressable disabled={busy} style={s.primary} onPress={login}><Text style={s.primaryText}>{busy?'Bağlanıyor…':'Giriş yap'}</Text></Pressable><Text style={s.hint}>Yerel HTTP bağlantısını yalnızca güvenilir Wi-Fi ağında test için kullan. Canlı kullanımda HTTPS gerekir.</Text></ScrollView></SafeAreaView></SafeAreaProvider></Modal>
  </SafeAreaView>;
}
export default function App() { return <AppContent/>; }
const s = StyleSheet.create({
  input:{color:'#F6F4EF',backgroundColor:'#1C1F27',padding:16,borderRadius:12,marginTop:8,borderWidth:1,borderColor:'#343741'},screen:{flex:1,backgroundColor:'#101217'}, content:{padding:24,paddingBottom:30}, header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28},brandMark:{padding:12,backgroundColor:'#242127',borderRadius:15}, brand:{color:'#F4F3EF',fontWeight:'800',fontSize:17,letterSpacing:1},small:{fontSize:9,color:'#858995',letterSpacing:1.4,marginTop:5},avatar:{width:42,height:42,borderRadius:21,backgroundColor:'#292D36',alignItems:'center',justifyContent:'center'},demo:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:28},dot:{width:6,height:6,borderRadius:3,backgroundColor:orange},demoText:{color:'#A7ABB6',fontSize:10,letterSpacing:1},eyebrow:{color:orange,fontSize:10,letterSpacing:2,fontWeight:'700'},title:{color:'#F6F4EF',fontSize:36,fontWeight:'700',lineHeight:43,letterSpacing:-1,marginTop:12,marginBottom:26},hero:{backgroundColor:'#1C1F27',padding:22,borderRadius:26,borderWidth:1,borderColor:'#30333C'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginVertical:12},heroLabel:{fontSize:10,color:'#A7ABB6',letterSpacing:1.3},badge:{backgroundColor:'#31312B',paddingHorizontal:10,paddingVertical:6,borderRadius:20},badgeText:{color:'#DDD2A8',fontSize:10},hours:{fontSize:34,color:'#F6F4EF',fontWeight:'700',marginVertical:14,letterSpacing:-1},muted:{fontSize:13,color:'#A2A6B1'},white:{fontSize:13,color:'#F6F4EF',fontWeight:'600'},divider:{height:1,backgroundColor:'#343741',marginTop:22,marginBottom:5},primary:{backgroundColor:orange,borderRadius:16,padding:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:20},primaryText:{color:'#17191F',fontWeight:'800',fontSize:15},hint:{color:'#969BA7',fontSize:10,textAlign:'center',marginTop:14,lineHeight:17},section:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:30,marginBottom:16},sectionTitle:{color:'#EEEDE8',fontSize:16,fontWeight:'600'},orange:{color:orange,fontSize:12},stats:{flexDirection:'row',gap:14},stat:{flex:1,backgroundColor:'#1A1D24',borderRadius:22,padding:20,borderWidth:1,borderColor:'#2C3039'},statValue:{fontSize:30,fontWeight:'700',color:'#F6F4EF',marginTop:20,marginBottom:7},unit:{fontSize:13,color:'#989DA9',fontWeight:'400'},notice:{flexDirection:'row',gap:16,backgroundColor:'#211E1D',borderRadius:20,padding:22,marginTop:20},footer:{color:'#616774',fontSize:9,letterSpacing:1.6,textAlign:'center',marginTop:30},nav:{flexDirection:'row',paddingTop:14,paddingBottom:12,borderTopWidth:1,borderColor:'#292D36',backgroundColor:'#15181F'},navItem:{flex:1,alignItems:'center',gap:6,padding:5},navLabel:{fontSize:10,color:'#858995'},camera:{height:260,borderRadius:24,overflow:'hidden',width:'100%'}
});
