import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * İlk render / provider sonrası yakalanmayan hataları gösterir (beyaz ekran yerine).
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Uygulama başlatılamadı</Text>
          <Text style={styles.sub}>Aşağıdaki mesajı geliştiriciyle paylaşın.</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.msg}>{this.state.error.message}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.btnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#94A3B8', fontSize: 14, marginBottom: 16 },
  scroll: { maxHeight: 200, marginBottom: 20 },
  msg: { color: '#FCA5A5', fontSize: 13, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
