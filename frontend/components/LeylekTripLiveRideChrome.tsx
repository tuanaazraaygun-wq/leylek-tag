import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
  agreedPrice?: number | null;
  vehicleKind?: string | null;
  pickup?: Coord | null;
  dropoff?: Coord | null;
  passengerLocation?: Coord | null;
  driverLocation?: Coord | null;
  sendingLocation: boolean;
  actionBusy: boolean;
  canStart: boolean;
  canFinish: boolean;
  onBack: () => void;
  onShareLocation: () => void;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

function vehicleLabel(vehicleKind?: string | null): string {
  return vehicleKind === 'motorcycle' ? 'Motor' : 'Araç';
}

function locationLabel(v?: Coord | null): string {
  return v ? 'Canli' : 'Bekleniyor';
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
  pickup,
  dropoff,
  passengerLocation,
  driverLocation,
  sendingLocation,
  actionBusy,
  canStart,
  canFinish,
  onBack,
  onShareLocation,
  onStart,
  onFinish,
  onCancel,
}: LeylekTripLiveRideChromeProps) {
  const matrixStatus = isDriver
    ? `${roleTitle.toUpperCase()} - MUHABBET YOLCULUK AKTIF`
    : 'SURUCU SIZIN ICIN HAZIR';
  const liveHint = driverLocation
    ? 'Sürücü konumu haritada canlı gösteriliyor'
    : statusDetail;

  return (
    <View style={styles.container}>
      <LeylekTripMapPreview
        pickup={pickup}
        dropoff={dropoff}
        passengerLocation={passengerLocation}
        driverLocation={driverLocation}
        style={styles.map}
      />

      <Pressable onPress={onBack} style={styles.mapBackButton} hitSlop={10}>
        <Ionicons name="chevron-back" size={25} color="#0F172A" />
      </Pressable>

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
                    {dropoffText}
                  </Text>
                </View>
                {agreedPrice != null ? (
                  <View style={styles.routeRowTrailColumn}>
                    <View style={styles.offeredPriceBadge}>
                      <Text style={styles.offeredPriceText}>₺{agreedPrice}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{statusLabel}</Text>
                <View style={styles.vehiclePill}>
                  <Ionicons name={vehicleKind === 'motorcycle' ? 'bicycle-outline' : 'car-sport-outline'} size={15} color="#334155" />
                  <Text style={styles.vehiclePillText}>{vehicleLabel(vehicleKind)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {isDriver ? (
          <View style={styles.driverMatchMatrixRow} pointerEvents="box-none">
            <View style={[styles.matrixContainerDriver, styles.matrixContainerDriverInRow]} pointerEvents="none">
              <Text style={styles.matrixTextDriver}>{matrixStatus}</Text>
            </View>
            <View style={styles.driverMatchYgitOuter}>
              <Pressable
                onPress={canStart ? onStart : onShareLocation}
                disabled={(canStart && actionBusy) || sendingLocation || isTerminal}
                style={({ pressed }) => [styles.driverMatchYgitTouch, pressed && { opacity: 0.86 }]}
              >
                <LinearGradient
                  colors={canStart ? ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA'] : ['#F97316', '#EA580C']}
                  style={styles.driverYolcuyaGitChip}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {canStart && actionBusy ? (
                    <ActivityIndicator size="small" color="#EFF6FF" />
                  ) : (
                    <Ionicons name={canStart ? 'play' : 'locate'} size={22} color="#EFF6FF" />
                  )}
                  <Text style={styles.driverYolcuyaGitChipLabel} numberOfLines={1}>
                    {canStart ? 'Başlat' : 'Konum Paylaş'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.matrixContainerPassenger} pointerEvents="none">
              <Text style={styles.matrixTextPassenger}>{matrixStatus}</Text>
            </View>
            <View style={styles.passengerLiveBlock} pointerEvents="none">
              <Text style={styles.passengerLiveLabel}>CANLI</Text>
              <Text style={styles.passengerLiveHint}>{liveHint}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.bottomGradient}>
          <View style={styles.tripActionBar} pointerEvents="box-none">
            <View style={styles.tripActionBarCol}>
              <Text style={isDriver ? styles.driverTripCallTitle : styles.callPromptLabelSingle} numberOfLines={1}>
                {isDriver ? 'Yolcu durumu' : 'Sürücü durumu'}
              </Text>
              <View style={styles.tripCallGuvenRow}>
                <View style={styles.tripCallChatCluster}>
                  <View style={[styles.mapCallFabCircle, !passengerLocation && styles.mapCallFabCircleDisabled]}>
                    <Ionicons name={isDriver ? 'person' : 'car-sport'} size={22} color="#FFF" />
                  </View>
                  <View style={styles.tripInlineChatBtn}>
                    <LinearGradient
                      colors={isDriver ? ['#F97316', '#EA580C'] : ['#3B82F6', '#2563EB']}
                      style={styles.tripInlineChatBtnGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="navigate" size={18} color="#FFF" />
                      <Text style={styles.tripInlineChatBtnText} numberOfLines={1}>
                        {statusDetail}
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
                <View style={styles.tripGuvenMirrorWrap}>
                  <Pressable
                    onPress={onShareLocation}
                    disabled={sendingLocation || isTerminal}
                    style={({ pressed }) => [styles.tripGuvenFabCompact, (pressed || sendingLocation || isTerminal) && { opacity: 0.7 }]}
                  >
                    <LinearGradient
                      colors={['#0D9488', '#059669', '#10B981', '#34D399']}
                      locations={[0, 0.35, 0.7, 1]}
                      style={styles.tripGuvenFabCompactInner}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {sendingLocation ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="locate" size={20} color="#FFF" />}
                      <Text style={styles.tripGuvenFabLabel}>Konum</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [styles.tripAiFabWrap, pressed && { opacity: 0.92 }]}
              onPress={onShareLocation}
              disabled={sendingLocation || isTerminal}
              accessibilityRole="button"
              accessibilityLabel="Konum paylaş"
            >
              <LinearGradient
                colors={['#22D3EE', '#3FA9F5', '#6366F1', '#8B5CF6']}
                locations={[0, 0.35, 0.65, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tripAiFabGrad}
              >
                <Ionicons name="locate" size={25} color="#FFF" />
              </LinearGradient>
              <Text style={styles.tripAiFabLabel} numberOfLines={1}>GPS</Text>
            </Pressable>

            {canFinish ? (
              <Pressable
                style={({ pressed }) => [styles.qrEndButton, (pressed || actionBusy) && { opacity: 0.86 }]}
                onPress={onFinish}
                disabled={actionBusy}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.qrEndButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.qrEndButtonText}>Yol Paylaşımını Bitir</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.qrEndButton}>
                <LinearGradient
                  colors={['#64748B', '#475569']}
                  style={styles.qrEndButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="time" size={18} color="#FFF" />
                  <Text style={styles.qrEndButtonText}>{statusLabel}</Text>
                </LinearGradient>
              </View>
            )}

            {!isTerminal ? (
              <Pressable
                style={({ pressed }) => [styles.endButton, (pressed || actionBusy) && { opacity: 0.78 }]}
                onPress={onCancel}
                disabled={actionBusy}
              >
                <Ionicons name="close-circle" size={18} color="#FFF" />
                <Text style={styles.endButtonText}>Zorla Bitir</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },
  map: { flex: 1, height: undefined, borderRadius: 0 },
  mapBackButton: {
    position: 'absolute',
    top: 42,
    left: 14,
    zIndex: 120,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
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
  driverMatchMatrixRow: {
    width: SCREEN_WIDTH * 0.885,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  driverMatchMatrixRowFlex1: { flex: 1 },
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
  matrixContainerDriverInRow: { marginLeft: 0, marginTop: 0, flexShrink: 1, marginRight: 10 },
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
  driverMatchYgitOuter: { flexShrink: 0 },
  driverMatchYgitTouch: { borderRadius: 14 },
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
  tripCallGuvenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
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
  tripGuvenMirrorWrap: { marginTop: -4 },
  tripGuvenFabCompact: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  tripGuvenFabCompactInner: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  tripGuvenFabLabel: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
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
