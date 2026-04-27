import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LeylekTripMapPreview from './LeylekTripMapPreview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Coord = { latitude: number; longitude: number };

type LeylekTripLiveRideChromeProps = {
  isDriver: boolean;
  isTerminal: boolean;
  roleTitle: string;
  statusLabel: string;
  statusDetail: string;
  pickupText: string;
  dropoffText: string;
  agreedPrice?: number | string | null;
  vehicleKind?: string | null;
  paymentMethod?: 'cash' | 'card' | null;
  routePolyline?: string | null;
  routeDistanceKm?: number | null;
  routeDurationMin?: number | null;
  sessionStatus?: string | null;
  pickup?: Coord | null;
  dropoff?: Coord | null;
  passengerLocation?: Coord | null;
  driverLocation?: Coord | null;
  deviceLocation?: Coord | null;
  routeDataMissing?: boolean;
  finishMethod?: 'qr' | 'forced' | null;
  finishScoreDelta?: number | null;
  forcedFinishResponse?: 'accepted' | 'declined' | 'timeout' | null;
  navigationLabel: string;
  navigationDisabled?: boolean;
  sendingLocation: boolean;
  actionBusy: boolean;
  callState: 'idle' | 'incoming' | 'outgoing' | 'active';
  callBusy: boolean;
  canStart: boolean;
  canFinish: boolean;
  onShareLocation: () => void;
  onStartCall: () => void;
  onJoinCall: () => void;
  onEndCall: () => void;
  onNavigate: () => void;
  onQrFinish: () => void;
  onForceFinish: () => void;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

function vehicleLabel(vehicleKind?: string | null): string {
  return vehicleKind === 'motorcycle' ? 'Motor' : 'Araç';
}

function paymentLabel(paymentMethod?: 'cash' | 'card' | null): string {
  if (paymentMethod === 'card') return 'Kart';
  if (paymentMethod === 'cash') return 'Nakit';
  return '';
}

function locationLabel(v?: Coord | null): string {
  return v ? 'Canlı' : 'Bekleniyor';
}

export default function LeylekTripLiveRideChrome({
  isDriver,
  isTerminal,
  roleTitle,
  statusLabel,
  statusDetail,
  pickupText,
  dropoffText,
  agreedPrice,
  vehicleKind,
  paymentMethod,
  routePolyline,
  routeDistanceKm,
  routeDurationMin,
  sessionStatus,
  pickup,
  dropoff,
  passengerLocation,
  driverLocation,
  deviceLocation,
  routeDataMissing,
  finishMethod,
  finishScoreDelta,
  forcedFinishResponse,
  navigationLabel,
  navigationDisabled,
  sendingLocation,
  actionBusy,
  callState,
  callBusy,
  canStart,
  canFinish,
  onShareLocation,
  onStartCall,
  onJoinCall,
  onEndCall,
  onNavigate,
  onQrFinish,
  onForceFinish,
  onStart,
  onFinish,
  onCancel,
}: LeylekTripLiveRideChromeProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 760, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  useEffect(() => {
    console.log('[leylek-trip-ui] action layout rendered role=%s', isDriver ? 'driver' : 'passenger');
  }, [isDriver]);
  const callButtonLabel =
    callState === 'incoming'
      ? 'Yanıtla'
      : callState === 'outgoing'
        ? 'Aranıyor'
        : callState === 'active'
          ? 'Kapat'
          : isDriver
            ? 'Yolcuyu Ara'
            : 'Sürücüyü Ara';
  const callButtonIcon: keyof typeof Ionicons.glyphMap =
    callState === 'incoming'
      ? 'call'
      : callState === 'active'
        ? 'call'
        : callState === 'outgoing'
          ? 'radio'
          : 'call';
  const handleCallPress = () => {
    if (callBusy || isTerminal) return;
    if (callState === 'incoming') {
      onJoinCall();
    } else if (callState === 'active' || callState === 'outgoing') {
      onEndCall();
    } else {
      onStartCall();
    }
  };
  const routeMetricLabel =
    routeDistanceKm != null && Number.isFinite(Number(routeDistanceKm))
      ? `${Number(routeDistanceKm).toFixed(1)} km${routeDurationMin != null ? ` • ${Math.max(1, Math.round(Number(routeDurationMin)))} dk` : ''}`
      : null;
  const paymentText = paymentLabel(paymentMethod);
  const qrButtonLabel =
    sessionStatus === 'ready'
      ? isDriver
        ? 'Biniş QR Göster'
        : 'Biniş QR Oku'
      : isDriver
        ? 'Hedefte QR Göster'
        : 'Hedefte QR Oku';
  const qrActionActive = sessionStatus === 'active' || sessionStatus === 'started';
  const finishSummary =
    finishMethod === 'qr'
      ? `Yolculuk QR ile tamamlandı • Puan etkisi: +${finishScoreDelta ?? 3}`
      : finishMethod === 'forced'
        ? `Yolculuk zorla bitirildi • Puan etkisi: ${finishScoreDelta ?? -5} • Karşı taraf yanıtı: ${
            forcedFinishResponse === 'accepted' ? 'Onayladı' : forcedFinishResponse === 'declined' ? 'Onaylamadı' : 'Kaydedilmedi'
          }`
        : null;

  return (
    <View style={styles.container}>
      <Image
        source={{
          uri: isDriver
            ? 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80'
            : 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80',
        }}
        style={styles.cloudBackground}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={[
          styles.cloudTintOverlay,
          { backgroundColor: isDriver ? 'rgba(124, 58, 237, 0.10)' : 'rgba(14, 165, 233, 0.08)' },
        ]}
      />
      <View style={styles.mapSlot}>
        <LeylekTripMapPreview
          pickup={pickup}
          dropoff={dropoff}
          passengerLocation={passengerLocation}
          driverLocation={driverLocation}
          deviceLocation={deviceLocation}
          routePolyline={routePolyline}
          sessionStatus={sessionStatus}
          style={styles.map}
        />
      </View>

      <View style={styles.topInfoPanel} pointerEvents="box-none">
        <View style={styles.topInfoBorder}>
          <LinearGradient
            colors={['#FFFFFF', '#FAFBFC', '#F4F7FA', '#FAFBFC']}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.infoGradient}
          >
            <View style={styles.topCardPatternRoot} pointerEvents="none">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => (
                <View key={i} style={[styles.topCardStripe, { left: -72 + i * 26 }]} />
              ))}
            </View>
            <View style={styles.topCardContent}>
              <View style={styles.routeInfoRow}>
                <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
                <View style={styles.routeTextStack}>
                  <Text style={styles.routeLabelModern}>Buluşma</Text>
                  <Text style={styles.routeValueModern} numberOfLines={1}>
                    {pickupText}
                  </Text>
                  <Text style={styles.routePolylineHint} numberOfLines={1}>
                    {locationLabel(isDriver ? passengerLocation : driverLocation)}
                  </Text>
                </View>
              </View>

              <View style={styles.routeInfoRow}>
                <View style={[styles.routeDot, { backgroundColor: '#F97316' }]} />
                <View style={styles.routeTextStack}>
                  <Text style={styles.routeLabelModern}>Hedef</Text>
                  <Text style={styles.routeValueModern} numberOfLines={1}>
                    {routeMetricLabel || dropoffText}
                  </Text>
                  {routeMetricLabel ? (
                    <Text style={styles.routePolylineHint} numberOfLines={1}>
                      {dropoffText}
                    </Text>
                  ) : null}
                </View>
                {agreedPrice != null ? (
                  <View style={styles.routeRowTrailColumn}>
                    <View style={styles.offeredPriceBadge}>
                      <Text style={styles.offeredPriceText}>₺{agreedPrice}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {routeDataMissing ? (
                <View style={styles.routeWarning}>
                  <Ionicons name="alert-circle-outline" size={15} color="#B45309" />
                  <Text style={styles.routeWarningText}>Alış/varış konumu henüz belirlenmedi.</Text>
                </View>
              ) : !routePolyline ? (
                <View style={styles.routeWarning}>
                  <Ionicons name="time-outline" size={15} color="#B45309" />
                  <Text style={styles.routeWarningText}>Rota hesaplanıyor</Text>
                </View>
              ) : null}

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{statusLabel}</Text>
                <View style={styles.vehiclePill}>
                  <Ionicons name={vehicleKind === 'motorcycle' ? 'bicycle-outline' : 'car-sport-outline'} size={15} color="#334155" />
                  <Text style={styles.vehiclePillText}>{vehicleLabel(vehicleKind)}</Text>
                </View>
                {paymentText ? (
                  <View style={styles.paymentPill}>
                    <Ionicons name={paymentMethod === 'card' ? 'card-outline' : 'cash-outline'} size={15} color="#0F766E" />
                    <Text style={styles.paymentPillText}>Ödeme: {paymentText}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.routeActionRow}>
          <Animated.View style={[styles.activeStatusChip, { opacity: pulse }]} pointerEvents="none">
            <View style={styles.activeStatusDot} />
            <Text style={styles.activeStatusText}>Yolculuk aktif</Text>
          </Animated.View>
          <View style={styles.routeActionCluster}>
            <Pressable
              onPress={canStart ? onStart : onShareLocation}
              disabled={(canStart && actionBusy) || sendingLocation || isTerminal}
              style={({ pressed }) => [styles.routeMiniAction, (pressed || sendingLocation || isTerminal) && { opacity: 0.78 }]}
            >
              <LinearGradient
                colors={canStart ? ['#1D4ED8', '#2563EB'] : ['#F97316', '#EA580C']}
                style={styles.routeMiniActionGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {canStart && actionBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={canStart ? 'play' : 'locate'} size={17} color="#FFF" />}
                <Text style={styles.routeMiniActionText}>{canStart ? 'Başlat' : 'Konum Paylaş'}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onNavigate}
              disabled={navigationDisabled || isTerminal}
              style={({ pressed }) => [styles.routeMiniAction, (pressed || navigationDisabled || isTerminal) && { opacity: 0.78 }]}
            >
              <LinearGradient
                colors={navigationDisabled || isTerminal ? ['#64748B', '#475569'] : ['#F97316', '#EA580C']}
                style={styles.routeMiniActionGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="navigate" size={17} color="#FFF" />
                <Text style={styles.routeMiniActionText}>{navigationLabel}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.bottomGradient}>
          {finishSummary ? (
            <View style={[styles.finishSummary, finishMethod === 'qr' ? styles.finishSummaryQr : styles.finishSummaryForced]}>
              <Ionicons name={finishMethod === 'qr' ? 'checkmark-circle' : 'warning'} size={16} color={finishMethod === 'qr' ? '#15803D' : '#92400E'} />
              <Text style={[styles.finishSummaryText, finishMethod === 'qr' ? styles.finishSummaryTextQr : styles.finishSummaryTextForced]}>
                {finishSummary}
              </Text>
            </View>
          ) : null}
          <View style={styles.primaryActionRow} pointerEvents="box-none">
            <Pressable
              onPress={handleCallPress}
              disabled={callBusy || isTerminal}
              style={({ pressed }) => [styles.primaryCircleButton, styles.callCircleButton, (pressed || callBusy || isTerminal) && { opacity: 0.72 }]}
              accessibilityRole="button"
              accessibilityLabel={callButtonLabel}
            >
              {callBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={callButtonIcon} size={28} color="#FFF" />}
              <Text style={styles.primaryCircleLabel}>{callButtonLabel}</Text>
            </Pressable>
          </View>
          <View style={styles.finishActionRow}>
            <Animated.View style={[styles.finishButton, qrActionActive && !isTerminal ? { opacity: pulse } : null]}>
              <Pressable
                style={({ pressed }) => [styles.finishButtonPressable, (pressed || actionBusy || isTerminal) && { opacity: 0.76 }]}
                onPress={onQrFinish}
                disabled={actionBusy || isTerminal}
              >
                <LinearGradient colors={isTerminal ? ['#64748B', '#475569'] : qrActionActive ? ['#F97316', '#EA580C'] : ['#8B5CF6', '#7C3AED']} style={styles.finishButtonGradient}>
                  <Ionicons name={isDriver ? 'qr-code-outline' : 'qr-code'} size={18} color="#FFF" />
                  <Text style={styles.finishButtonText}>{qrButtonLabel}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <Pressable
              style={({ pressed }) => [styles.finishButton, (pressed || actionBusy || isTerminal) && { opacity: 0.76 }]}
              onPress={onForceFinish}
              disabled={actionBusy || isTerminal}
            >
              <LinearGradient colors={isTerminal ? ['#64748B', '#475569'] : ['#DC2626', '#B91C1C']} style={styles.finishButtonGradient}>
                <Ionicons name="warning-outline" size={18} color="#FFF" />
                <Text style={styles.finishButtonText}>Zorla Bitir</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  cloudBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
    opacity: 0.14,
  },
  cloudTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  mapSlot: { flex: 1, position: 'relative' },
  map: { flex: 1, height: undefined, borderRadius: 0 },
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90 },
  topInfoBorder: {
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.885,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.38)',
    borderRadius: 20,
    marginTop: 40,
    marginBottom: 6,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  infoGradient: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 19, overflow: 'hidden' },
  topCardPatternRoot: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  topCardStripe: {
    position: 'absolute',
    top: -80,
    width: 1,
    height: 320,
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
    transform: [{ rotate: '32deg' }],
  },
  topCardContent: { position: 'relative', zIndex: 2, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20 },
  routeInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  routeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  routeTextStack: { flex: 1, minWidth: 0 },
  routeRowTrailColumn: { alignItems: 'flex-end', gap: 8, marginLeft: 4, flexShrink: 0 },
  routeLabelModern: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  routeValueModern: { fontSize: 17, fontWeight: '700', color: '#0F172A', letterSpacing: 0.15, marginTop: 0 },
  routePolylineHint: { fontSize: 10, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  routeWarning: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  routeWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  offeredPriceBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  offeredPriceText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.45)',
  },
  priceLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.6 },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  vehiclePillText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  paymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 253, 250, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.28)',
  },
  paymentPillText: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  routeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 6,
    gap: 10,
  },
  activeStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 46, 22, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activeStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  activeStatusText: { color: '#BBF7D0', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  routeActionCluster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flex: 1 },
  routeMiniAction: { borderRadius: 13, overflow: 'hidden', flexShrink: 1 },
  routeMiniActionGrad: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  routeMiniActionText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  driverMatchMatrixRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 6,
    zIndex: 91,
  },
  driverMatchMatrixRowFlex1: { flex: 1, minWidth: 8 },
  matrixContainerDriver: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginTop: 6,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 20, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF00',
  },
  matrixContainerDriverInRow: { marginLeft: 0, marginTop: 0, flexShrink: 1, maxWidth: '58%' },
  matrixTextDriver: { fontSize: 12, fontWeight: '800', color: '#00FF00', letterSpacing: 1.5 },
  matrixContainerPassenger: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginTop: 6,
    zIndex: 1000,
    backgroundColor: 'rgba(30, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  matrixTextPassenger: { fontSize: 12, fontWeight: '800', color: '#FF3B30', letterSpacing: 1.5 },
  passengerLiveBlock: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    marginRight: 18,
    marginTop: 4,
    marginBottom: 2,
    maxWidth: SCREEN_WIDTH * 0.62,
  },
  passengerLiveLabel: { color: '#DC2626', fontSize: 11, fontWeight: '900', letterSpacing: 4 },
  passengerLiveHint: {
    marginTop: 6,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  driverMatchYgitOuter: { position: 'relative', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  driverMatchYgitGlowAura: {
    position: 'absolute',
    width: 152,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(37, 99, 235, 0.38)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 12,
  },
  driverMatchYgitTouch: { zIndex: 2 },
  driverYolcuyaGitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    minWidth: 168,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 8,
  },
  driverYolcuyaGitChipLabel: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomGradient: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, backgroundColor: 'transparent' },
  finishSummary: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  finishSummaryQr: { backgroundColor: 'rgba(220, 252, 231, 0.95)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)' },
  finishSummaryForced: { backgroundColor: 'rgba(254, 243, 199, 0.95)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.25)' },
  finishSummaryText: { flex: 1, fontSize: 12, fontWeight: '900', lineHeight: 17 },
  finishSummaryTextQr: { color: '#15803D' },
  finishSummaryTextForced: { color: '#92400E' },
  primaryActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18, marginBottom: 12 },
  primaryCircleButton: {
    flex: 1,
    minHeight: 70,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.36,
    shadowRadius: 12,
    elevation: 10,
  },
  callCircleButton: { backgroundColor: '#16A34A', shadowColor: '#064E3B' },
  primaryCircleLabel: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  tripActionBar: { width: '100%', marginBottom: 10 },
  tripActionBarCol: { width: '100%', paddingHorizontal: 2 },
  driverTripCallTitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  callPromptLabelSingle: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.25,
    maxWidth: SCREEN_WIDTH * 0.88,
    marginBottom: 8,
    textShadowColor: 'rgba(74, 222, 128, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tripCallChatCluster: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  mapCallFabCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#0D4F3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 8,
  },
  mapCallFabCircleDisabled: { opacity: 0.55 },
  mapCallFabCircleActive: { backgroundColor: '#DC2626', shadowColor: '#7F1D1D' },
  tripInlineChatBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: SCREEN_WIDTH * 0.48,
    flexShrink: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  tripInlineChatBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  tripInlineChatBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.15 },
  finishActionRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 10 },
  finishButton: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  finishButtonPressable: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  finishButtonGradient: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  finishButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  actionButtons: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  tripAiFabWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 52, maxWidth: 56 },
  tripAiFabGrad: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 10,
  },
  tripAiFabLabel: { fontSize: 10, fontWeight: '900', color: '#334155', marginTop: 4, letterSpacing: 0.6 },
  navigationButton: { flex: 1.35, borderRadius: 12, overflow: 'hidden' },
  navigationButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  navigationButtonText: { fontSize: 12, fontWeight: '800', marginLeft: 6, color: '#FFF' },
  qrEndButton: { flex: 2, borderRadius: 12, overflow: 'hidden' },
  qrEndButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  qrEndButtonText: { fontSize: 13, fontWeight: '700', marginLeft: 6, color: '#FFF' },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#DC2626',
    borderRadius: 12,
  },
  endButtonText: { fontSize: 12, fontWeight: '600', marginLeft: 4, color: '#FFF' },
});
