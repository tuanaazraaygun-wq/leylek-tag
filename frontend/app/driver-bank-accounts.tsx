import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPersistedUserRaw } from '../lib/sessionToken';
import {
  createDriverBankAccount,
  deleteDriverBankAccount,
  getDriverBankAccount,
  listDriverBankAccounts,
  setDefaultDriverBankAccount,
  updateDriverBankAccount,
  type DriverBankAccountListItem,
} from '../lib/driverBankApi';
import { appAlert } from '../contexts/AppAlertContext';
import { PaymentLegalDisclaimer } from '../components/legal/PaymentLegalDisclaimer';
import { IBAN_OPTIONAL_NOTICE, IBAN_SHARING_NOTICE } from '../lib/legalUxCopy';

type ScreenUser = {
  id?: string;
  role?: string;
};

function clearFormState(setters: {
  setFormVisible: (v: boolean) => void;
  setEditingAccountId: (v: string | null) => void;
  setFormIban: (v: string) => void;
  setFormHolderName: (v: string) => void;
  setFormLabel: (v: string) => void;
  setFormIsDefault: (v: boolean) => void;
}) {
  setters.setFormVisible(false);
  setters.setEditingAccountId(null);
  setters.setFormIban('');
  setters.setFormHolderName('');
  setters.setFormLabel('');
  setters.setFormIsDefault(false);
}

export default function DriverBankAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState('');
  const [isDriver, setIsDriver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<DriverBankAccountListItem[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formIban, setFormIban] = useState('');
  const [formHolderName, setFormHolderName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [actionAccountId, setActionAccountId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    clearFormState({
      setFormVisible,
      setEditingAccountId,
      setFormIban,
      setFormHolderName,
      setFormLabel,
      setFormIsDefault,
    });
  }, []);

  const loadAccounts = useCallback(async (uid: string, opts?: { silent?: boolean }) => {
    if (!uid) return;
    if (!opts?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setLoadError(null);

    const result = await listDriverBankAccounts(uid);
    if (!opts?.silent) {
      setLoading(false);
    } else {
      setRefreshing(false);
    }

    if (result.ok) {
      setFeatureUnavailable(false);
      setAccounts(Array.isArray(result.data.accounts) ? result.data.accounts : []);
      return;
    }

    if (result.code === 'UNAVAILABLE') {
      setFeatureUnavailable(true);
      setAccounts([]);
      return;
    }

    setFeatureUnavailable(false);
    setLoadError(result.message);
    setAccounts([]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getPersistedUserRaw();
        if (!raw) {
          setLoading(false);
          setLoadError('Giriş yapmanız gerekiyor');
          return;
        }
        const parsed = JSON.parse(raw) as ScreenUser;
        const uid = String(parsed?.id || '').trim();
        const driver = parsed?.role === 'driver';
        setUserId(uid);
        setIsDriver(driver);
        if (!driver) {
          setLoading(false);
          return;
        }
        if (uid) {
          await loadAccounts(uid);
        } else {
          setLoading(false);
          setLoadError('Kullanıcı bilgisi yüklenemedi');
        }
      } catch {
        setLoading(false);
        setLoadError('Kullanıcı bilgisi yüklenemedi');
      }
    })();
  }, [loadAccounts]);

  const openCreateForm = () => {
    resetForm();
    setFormIsDefault(accounts.length === 0);
    setFormVisible(true);
  };

  const openEditForm = async (accountId: string) => {
    if (!userId || featureUnavailable) return;
    setLoadingEdit(true);
    setFormVisible(true);
    setEditingAccountId(accountId);
    setFormIban('');
    setFormHolderName('');
    setFormLabel('');
    setFormIsDefault(false);

    const result = await getDriverBankAccount(userId, accountId);
    setLoadingEdit(false);

    if (!result.ok) {
      resetForm();
      appAlert('IBAN', result.message);
      return;
    }

    const acc = result.data.account;
    setFormIban(acc.iban || '');
    setFormHolderName(String(acc.account_holder_name || '').trim());
    setFormLabel(String(acc.label || '').trim());
    setFormIsDefault(Boolean(acc.is_default));
  };

  const handleSave = async () => {
    if (!userId || saving || featureUnavailable) return;

    const iban = formIban.trim();
    const holder = formHolderName.trim();
    const label = formLabel.trim();

    if (!iban) {
      appAlert('IBAN', 'IBAN alanı zorunludur.');
      return;
    }
    if (holder.length < 2) {
      appAlert('IBAN', 'Hesap sahibi adı en az 2 karakter olmalı.');
      return;
    }

    setSaving(true);
    try {
      if (editingAccountId) {
        const result = await updateDriverBankAccount(userId, editingAccountId, {
          iban,
          account_holder_name: holder,
          label: label || null,
          is_default: formIsDefault,
        });
        if (!result.ok) {
          appAlert('IBAN', result.message);
          return;
        }
      } else {
        const result = await createDriverBankAccount(userId, {
          iban,
          account_holder_name: holder,
          label: label || null,
          is_default: formIsDefault || accounts.length === 0,
        });
        if (!result.ok) {
          appAlert('IBAN', result.message);
          return;
        }
      }

      resetForm();
      appAlert('IBAN', 'IBAN kaydedildi');
      await loadAccounts(userId, { silent: true });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    if (!userId || featureUnavailable || actionAccountId) return;
    setActionAccountId(accountId);
    const result = await setDefaultDriverBankAccount(userId, accountId);
    setActionAccountId(null);
    if (!result.ok) {
      appAlert('IBAN', result.message);
      return;
    }
    await loadAccounts(userId, { silent: true });
  };

  const handleDelete = (accountId: string) => {
    if (!userId || featureUnavailable) return;
    Alert.alert(
      'IBAN sil',
      'Bu IBAN hesabını silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionAccountId(accountId);
              const result = await deleteDriverBankAccount(userId, accountId);
              setActionAccountId(null);
              if (!result.ok) {
                appAlert('IBAN', result.message);
                return;
              }
              await loadAccounts(userId, { silent: true });
            })();
          },
        },
      ],
    );
  };

  const crudEnabled = isDriver && !featureUnavailable && !loading;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#22D3EE" />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Katkı payı bilgileri</Text>
          <Text style={styles.subtitle}>IBAN bilginizi yönetin</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color="#22D3EE" />
          <Text style={styles.infoText}>{IBAN_SHARING_NOTICE}</Text>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="wallet-outline" size={18} color="#22D3EE" />
          <Text style={styles.infoText}>{IBAN_OPTIONAL_NOTICE}</Text>
        </View>

        <PaymentLegalDisclaimer compact showDetailLink />

        {!isDriver ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Sadece sürücüler</Text>
            <Text style={styles.emptySub}>IBAN yönetimi yalnızca sürücü hesapları için kullanılabilir.</Text>
          </View>
        ) : null}

        {isDriver && featureUnavailable ? (
          <View style={styles.card}>
            <Text style={styles.unavailableTitle}>Bu özellik şu an aktif değil</Text>
            <Text style={styles.unavailableSub}>
              IBAN yönetimi sunucuda henüz açılmamış. Nakit akışınız etkilenmez.
            </Text>
          </View>
        ) : null}

        {isDriver && loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#22D3EE" />
            <Text style={styles.loadingText}>Hesaplar yükleniyor…</Text>
          </View>
        ) : null}

        {isDriver && !loading && loadError ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Yüklenemedi</Text>
            <Text style={styles.emptySub}>{loadError}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void loadAccounts(userId)}>
              <Text style={styles.primaryBtnText}>Yeniden dene</Text>
            </Pressable>
          </View>
        ) : null}

        {isDriver && !loading && !loadError && !featureUnavailable && accounts.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Henüz IBAN eklemediniz</Text>
            <Pressable style={styles.primaryBtn} onPress={openCreateForm}>
              <Ionicons name="add-circle-outline" size={18} color="#08111F" />
              <Text style={styles.primaryBtnText}>IBAN ekle</Text>
            </Pressable>
          </View>
        ) : null}

        {isDriver && !loading && !loadError && !featureUnavailable && accounts.length > 0 ? (
          <>
            {accounts.map((acc) => {
              const busy = actionAccountId === acc.id;
              const title = (acc.label || '').trim() || 'IBAN hesabı';
              return (
                <View key={acc.id} style={styles.card}>
                  <View style={styles.accountHeader}>
                    <View style={styles.accountTitleCol}>
                      <Text style={styles.accountTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      {acc.is_default ? (
                        <View style={styles.defaultBadge}>
                          <Ionicons name="star" size={11} color="#08111F" />
                          <Text style={styles.defaultBadgeText}>Varsayılan</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.accountHolder} numberOfLines={2}>
                    {acc.account_holder_name || '—'}
                  </Text>
                  <Text style={styles.accountIban}>{acc.iban_masked || '—'}</Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.actionBtn}
                      disabled={busy}
                      onPress={() => void openEditForm(acc.id)}
                    >
                      <Text style={styles.actionBtnText}>Düzenle</Text>
                    </Pressable>
                    {!acc.is_default ? (
                      <Pressable
                        style={styles.actionBtn}
                        disabled={busy}
                        onPress={() => void handleSetDefault(acc.id)}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#22D3EE" />
                        ) : (
                          <Text style={styles.actionBtnText}>Varsayılan yap</Text>
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      disabled={busy}
                      onPress={() => handleDelete(acc.id)}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Sil</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Pressable style={styles.secondaryBtn} onPress={openCreateForm}>
              <Ionicons name="add" size={18} color="#22D3EE" />
              <Text style={styles.secondaryBtnText}>IBAN ekle</Text>
            </Pressable>
          </>
        ) : null}

        {refreshing ? (
          <View style={styles.refreshHint}>
            <ActivityIndicator size="small" color="#22D3EE" />
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={resetForm}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingAccountId ? 'IBAN düzenle' : 'IBAN ekle'}</Text>
                <Pressable onPress={resetForm} hitSlop={12}>
                  <Ionicons name="close" size={22} color="rgba(172, 188, 212, 0.95)" />
                </Pressable>
              </View>

              {loadingEdit ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#22D3EE" />
                </View>
              ) : (
                <>
                  <ScrollView
                    style={styles.modalScroll}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.modalBody}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.fieldLabel}>IBAN</Text>
                    <TextInput
                      style={styles.input}
                      value={formIban}
                      onChangeText={setFormIban}
                      placeholder="TR00 0000 0000 0000 0000 0000 00"
                      placeholderTextColor="rgba(148, 163, 184, 0.55)"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={crudEnabled && !saving}
                    />

                    <Text style={styles.fieldLabel}>Hesap sahibi ad soyad</Text>
                    <TextInput
                      style={styles.input}
                      value={formHolderName}
                      onChangeText={setFormHolderName}
                      placeholder="Ad Soyad"
                      placeholderTextColor="rgba(148, 163, 184, 0.55)"
                      autoCapitalize="words"
                      editable={crudEnabled && !saving}
                    />

                    <Text style={styles.fieldLabel}>Etiket (isteğe bağlı)</Text>
                    <TextInput
                      style={styles.input}
                      value={formLabel}
                      onChangeText={setFormLabel}
                      placeholder="Ev, iş…"
                      placeholderTextColor="rgba(148, 163, 184, 0.55)"
                      editable={crudEnabled && !saving}
                    />

                    <View style={styles.switchRow}>
                      <View style={styles.switchTextCol}>
                        <Text style={styles.switchLabel}>Varsayılan hesap</Text>
                        <Text style={styles.switchHint}>Eşleşmede yolcuya gösterilecek hesap</Text>
                      </View>
                      <Switch
                        value={formIsDefault}
                        onValueChange={setFormIsDefault}
                        disabled={!crudEnabled || saving}
                        trackColor={{ false: '#1E3A5F', true: 'rgba(34, 211, 238, 0.45)' }}
                        thumbColor={formIsDefault ? '#22D3EE' : '#94A3B8'}
                      />
                    </View>
                    <PaymentLegalDisclaimer compact showDetailLink />
                  </ScrollView>

                  <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <Pressable
                      style={[styles.primaryBtn, styles.modalSaveBtn, saving ? styles.btnDisabled : null]}
                      disabled={saving || !crudEnabled}
                      onPress={() => void handleSave()}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#08111F" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Kaydet</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08111F' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
  },
  headerBody: { marginLeft: 10, flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: 'rgba(243, 248, 255, 0.96)' },
  subtitle: { marginTop: 4, fontSize: 13, color: 'rgba(172, 188, 212, 0.92)' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 26, 43, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.18)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(172, 188, 212, 0.95)',
  },
  card: {
    backgroundColor: 'rgba(16, 26, 43, 0.78)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34, 211, 238, 0.14)',
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.94)',
    marginBottom: 6,
  },
  unavailableSub: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(172, 188, 212, 0.92)',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { fontSize: 13, color: 'rgba(172, 188, 212, 0.9)' },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.94)',
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(172, 188, 212, 0.92)',
    marginBottom: 12,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  accountTitleCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  accountTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(243, 248, 255, 0.94)',
    flexShrink: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#22D3EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: '800', color: '#08111F' },
  accountHolder: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(203, 213, 225, 0.95)',
    marginBottom: 4,
  },
  accountIban: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    color: '#22D3EE',
    marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    backgroundColor: 'rgba(16, 26, 43, 0.6)',
    minWidth: 88,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#22D3EE' },
  actionBtnDanger: { borderColor: 'rgba(248, 113, 113, 0.35)' },
  actionBtnDangerText: { color: 'rgba(248, 113, 113, 0.95)' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#08111F' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#22D3EE' },
  refreshHint: { alignItems: 'center', paddingVertical: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 8, 24, 0.72)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    width: '100%',
    maxHeight: '88%',
  },
  modalSheet: {
    maxHeight: '100%',
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30, 58, 95, 0.55)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: 'rgba(243, 248, 255, 0.96)' },
  modalScroll: { flexGrow: 0, flexShrink: 1 },
  modalBody: { padding: 16, gap: 8, paddingBottom: 8 },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalLoading: { padding: 32, alignItems: 'center' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(172, 188, 212, 0.95)',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: 'rgba(243, 248, 255, 0.96)',
    backgroundColor: 'rgba(16, 26, 43, 0.88)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  switchTextCol: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(243, 248, 255, 0.93)' },
  switchHint: { fontSize: 12, color: 'rgba(148, 163, 184, 0.85)', marginTop: 2 },
  modalSaveBtn: { marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
});
