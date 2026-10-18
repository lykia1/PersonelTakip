import React, { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Tab = 'Bugün' | 'Vardiya' | 'Geçmiş' | 'Profil';
const orange = '#FF743D';
const shifts = [['Pazartesi', '09:00 — 18:00'], ['Salı', '09:00 — 18:00'], ['Çarşamba', 'İzin günü'], ['Perşembe', '12:00 — 21:00'], ['Cuma', '12:00 — 21:00']];
function AppContent() {
  const [tab, setTab] = useState<Tab>('Bugün');
  const [stage, setStage] = useState<'closed' | 'qr' | 'selfie' | 'review'>('closed');
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const scanLock = useRef(false);
  const camera = useRef<CameraView>(null);
  const close = () => { setStage('closed'); setPhoto(undefined); scanLock.current = false; };
  async function start() {
    try {
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) return Alert.alert('Kamera izni gerekli', 'QR ve anlık fotoğraf için kamera iznini açmalısın.');
      scanLock.current = false; setStage('qr');
    } catch { Alert.alert('Kamera açılamadı', 'Telefon ayarlarından kamera iznini kontrol et.'); }
  }
  async function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true; setBusy(true);
    try {
      // Only the format is checked here. Authenticity, expiry and location MUST be checked by the API.
      if (!data.startsWith('personeltakip:')) throw new Error('Bu bir PersonelTakip QR kodu değil.');
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.granted) throw new Error('Devam etmek için konum izni gerekli.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (position.mocked) throw new Error('Sahte konum ile işlem yapılamaz.');
      setStage('selfie');
    } catch (e) { Alert.alert('İşlem tamamlanamadı', e instanceof Error ? e.message : 'Konum alınamadı. Tekrar dene.'); scanLock.current = false; }
    finally { setBusy(false); }
  }
  async function capture() {
    if (busy) return; setBusy(true);
    try {
      const result = await camera.current?.takePictureAsync({ quality: 0.6 });
      if (!result) throw new Error();
      setPhoto(result.uri); setStage('review');
    } catch { Alert.alert('Fotoğraf çekilemedi', 'Tekrar deneyebilirsin.'); }
    finally { setBusy(false); }
  }
  const row = (label: string, value: string) => <View key={label} style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.white}>{value}</Text></View>;
  return <SafeAreaView style={s.screen}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}><View style={s.brandMark}><Ionicons name="layers" size={23} color={orange}/></View><View style={{ flex: 1 }}><Text style={s.brand}>ATÖLYE <Text style={{ color: orange }}>EKİP</Text></Text><Text style={s.small}>DÖNER ATÖLYESİ · PERSONEL</Text></View><View style={s.avatar}><Text style={s.white}>DA</Text></View></View>
      <View style={s.demo}><View style={s.dot}/><Text style={s.demoText}>TASARIM ÖNİZLEMESİ · Örnek veriler</Text></View>
      <Text style={s.eyebrow}>BİRLİKTE DAHA GÜÇLÜ</Text>
      <Text style={s.title}>{tab === 'Bugün' ? 'Güzel bir güne\nbaşlayalım.' : tab === 'Vardiya' ? 'Haftanı\nplanla.' : tab === 'Geçmiş' ? 'Emeğinin\nkaydı burada.' : 'Senin\nçalışma alanın.'}</Text>
      {tab === 'Bugün' && <>
        <View style={s.hero}><View style={s.row}><Text style={s.heroLabel}>BUGÜNKÜ VARDİYAN</Text><View style={s.badge}><Text style={s.badgeText}>Planlandı</Text></View></View><Text style={s.hours}>09:00 <Text style={{ color: '#777C87' }}>—</Text> 18:00</Text><Text style={s.muted}>Merkez Şube  ·  Servis ekibi</Text><View style={s.divider}/><View style={s.row}><Text style={s.muted}>Mesai durumu</Text><Text style={s.white}>Henüz başlamadı</Text></View><Pressable accessibilityRole="button" style={s.primary} onPress={start}><Ionicons name="qr-code-outline" color="#17191F" size={24}/><Text style={s.primaryText}>QR ile mesai başlat</Text><Ionicons name="arrow-forward" size={21}/></Pressable><Text style={s.hint}>QR okut · Konum paylaş · Anlık fotoğraf çek</Text></View>
        <View style={s.section}><Text style={s.sectionTitle}>Bu ay nasıl gidiyor?</Text><Text style={s.orange}>Örnek özet</Text></View>
        <View style={s.stats}><View style={s.stat}><Ionicons name="time-outline" size={24} color={orange}/><Text style={s.statValue}>128 <Text style={s.unit}>sa</Text></Text><Text style={s.muted}>Çalışma süresi</Text></View><View style={s.stat}><Ionicons name="calendar-outline" size={24} color={orange}/><Text style={s.statValue}>16 <Text style={s.unit}>gün</Text></Text><Text style={s.muted}>Katılım</Text></View></View>
        <View style={s.notice}><Ionicons name="sparkles-outline" size={24} color={orange}/><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Her emek değerli.</Text><Text style={[s.muted, { marginTop: 8, lineHeight: 22 }]}>Vardiyalarını ve çalışma kayıtlarını tek bir yerden takip et.</Text></View></View>
      </>}
      {tab === 'Vardiya' && <View style={s.hero}><Text style={s.sectionTitle}>Örnek haftalık plan</Text>{shifts.map(([day,time]) => row(day,time))}<Text style={s.hint}>Gerçek vardiyalar sunucu bağlantısıyla görünecek.</Text></View>}
      {tab === 'Geçmiş' && <View style={s.hero}><Text style={s.sectionTitle}>Örnek mesai kayıtları</Text>{row('16 Ekim · Cuma', '09:02 — 18:00')}{row('15 Ekim · Perşembe', '09:00 — 18:05')}{row('14 Ekim · Çarşamba', 'İzinli')}<Text style={s.hint}>Bu kayıtlar tasarım amaçlıdır.</Text></View>}
      {tab === 'Profil' && <View style={s.hero}><Text style={s.sectionTitle}>Personel hesabı</Text>{row('İşletme', 'Döner Atölyesi')}{row('Şube', 'Merkez')}{row('Oturum', 'Demo')}<Text style={[s.muted, { lineHeight: 23 }]}>Hesap, izin talepleri ve performans değerlendirmeleri sunucu bağlantısıyla etkinleştirilecek. Fotoğraf bu önizlemede gönderilmez veya kalıcı kaydedilmez.</Text></View>}
      <Text style={s.footer}>ATÖLYE EKİP / İNSAN ODAKLI ÇALIŞMA</Text>
    </ScrollView>
    <View style={s.nav}>{(['Bugün','Vardiya','Geçmiş','Profil'] as Tab[]).map((item,i) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={s.navItem}><Ionicons name={(['grid-outline','calendar-outline','time-outline','person-outline'] as const)[i]} size={23} color={tab === item ? orange : '#858995'}/><Text style={[s.navLabel, tab === item && { color: orange }]}>{item}</Text></Pressable>)}</View>
    <Modal visible={stage !== 'closed'} animationType="slide" onRequestClose={close}><SafeAreaView style={s.screen}><View style={s.content}><Pressable onPress={close} accessibilityLabel="Kapat"><Text style={s.orange}>✕  Kapat</Text></Pressable><Text style={s.title}>{stage === 'qr' ? 'Kasadaki QR’ı okut.' : stage === 'selfie' ? 'Anlık fotoğrafını çek.' : 'Fotoğraf hazır.'}</Text><Text style={[s.muted,{ marginBottom: 20, lineHeight: 22 }]}>{stage === 'qr' ? 'Önizleme: personeltakip: ile başlayan test QR kodu kullan. Sunucu doğrulaması henüz bağlı değil.' : stage === 'selfie' ? 'Yüzünü çerçevenin ortasına getir. Bu adım otomatik yüz tanıma yapmaz.' : 'Sunucu bağlantısı olmadığı için mesai başlatılmadı. Fotoğraf yüklenmedi.'}</Text>
      {stage === 'qr' && <CameraView style={s.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : ({data}) => void scan(data)}/>}
      {stage === 'selfie' && <><CameraView key="selfie" ref={camera} style={s.camera} facing="front"/><Pressable disabled={busy} style={s.primary} onPress={capture}><Text style={s.primaryText}>{busy ? 'Çekiliyor…' : 'Fotoğraf çek'}</Text></Pressable></>}
      {stage === 'review' && <>{photo && <Image source={{ uri: photo }} style={s.camera}/>}<Pressable style={s.primary} onPress={close}><Text style={s.primaryText}>Önizlemeyi tamamla</Text></Pressable></>}
      {busy && stage === 'qr' && <Text style={s.hint}>Konum alınıyor…</Text>}
    </View></SafeAreaView></Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><AppContent/></SafeAreaProvider>; }
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#101217'}, content:{padding:24,paddingBottom:30}, header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28},brandMark:{padding:12,backgroundColor:'#242127',borderRadius:15}, brand:{color:'#F4F3EF',fontWeight:'800',fontSize:17,letterSpacing:1},small:{fontSize:9,color:'#858995',letterSpacing:1.4,marginTop:5},avatar:{width:42,height:42,borderRadius:21,backgroundColor:'#292D36',alignItems:'center',justifyContent:'center'},demo:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:28},dot:{width:6,height:6,borderRadius:3,backgroundColor:orange},demoText:{color:'#A7ABB6',fontSize:10,letterSpacing:1},eyebrow:{color:orange,fontSize:10,letterSpacing:2,fontWeight:'700'},title:{color:'#F6F4EF',fontSize:36,fontWeight:'700',lineHeight:43,letterSpacing:-1,marginTop:12,marginBottom:26},hero:{backgroundColor:'#1C1F27',padding:22,borderRadius:26,borderWidth:1,borderColor:'#30333C'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginVertical:12},heroLabel:{fontSize:10,color:'#A7ABB6',letterSpacing:1.3},badge:{backgroundColor:'#31312B',paddingHorizontal:10,paddingVertical:6,borderRadius:20},badgeText:{color:'#DDD2A8',fontSize:10},hours:{fontSize:34,color:'#F6F4EF',fontWeight:'700',marginVertical:14,letterSpacing:-1},muted:{fontSize:13,color:'#A2A6B1'},white:{fontSize:13,color:'#F6F4EF',fontWeight:'600'},divider:{height:1,backgroundColor:'#343741',marginTop:22,marginBottom:5},primary:{backgroundColor:orange,borderRadius:16,padding:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:20},primaryText:{color:'#17191F',fontWeight:'800',fontSize:15},hint:{color:'#969BA7',fontSize:10,textAlign:'center',marginTop:14,lineHeight:17},section:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:30,marginBottom:16},sectionTitle:{color:'#EEEDE8',fontSize:16,fontWeight:'600'},orange:{color:orange,fontSize:12},stats:{flexDirection:'row',gap:14},stat:{flex:1,backgroundColor:'#1A1D24',borderRadius:22,padding:20,borderWidth:1,borderColor:'#2C3039'},statValue:{fontSize:30,fontWeight:'700',color:'#F6F4EF',marginTop:20,marginBottom:7},unit:{fontSize:13,color:'#989DA9',fontWeight:'400'},notice:{flexDirection:'row',gap:16,backgroundColor:'#211E1D',borderRadius:20,padding:22,marginTop:20},footer:{color:'#616774',fontSize:9,letterSpacing:1.6,textAlign:'center',marginTop:30},nav:{flexDirection:'row',paddingTop:14,paddingBottom:12,borderTopWidth:1,borderColor:'#292D36',backgroundColor:'#15181F'},navItem:{flex:1,alignItems:'center',gap:6,padding:5},navLabel:{fontSize:10,color:'#858995'},camera:{height:330,borderRadius:24,overflow:'hidden',width:'100%'}
});
