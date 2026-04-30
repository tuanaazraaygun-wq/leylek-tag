/**
 * Muhabbet Leylek trip — Socket.IO JWT kaydı (`registered`) reconnect yarışlarını tolere eder.
 */
import type { Socket } from 'socket.io-client';
import {
  getLastRegisteredSocketSid,
  getLastRegisteredSocketUserId,
  getOrCreateSocket,
} from '../contexts/SocketContext';
import { notifyAuthTokenBecameAvailableForSocket } from './socketRegisterScheduler';

export function isMuhabbetSocketRegisteredForUser(socket: Socket, myUserLo: string): boolean {
  const lo = (myUserLo || '').trim().toLowerCase();
  if (!socket.connected || !lo) return false;
  const sid = socket.id;
  if (!sid || sid !== getLastRegisteredSocketSid()) return false;
  const ru = (getLastRegisteredSocketUserId() || '').trim().toLowerCase();
  return ru === lo;
}

function waitForNextRegisterSuccess(socket: Socket, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(tid);
      socket.off('registered', onReg);
      resolve(ok);
    };
    const tid = setTimeout(() => finish(false), timeoutMs);
    const onReg = (data: { success?: boolean }) => {
      if (data?.success === true) finish(true);
    };
    socket.on('registered', onReg);
    notifyAuthTokenBecameAvailableForSocket();
  });
}

function waitSocketConnected(socket: Socket, timeoutMs: number): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const tid = setTimeout(() => {
      socket.off('connect', onC);
      resolve(false);
    }, timeoutMs);
    const onC = () => {
      clearTimeout(tid);
      socket.off('connect', onC);
      resolve(true);
    };
    socket.on('connect', onC);
    try {
      socket.connect();
    } catch {
      /* noop */
    }
  });
}

/** Toplam süre `timeoutMs`’yi aşmaz; bağlantı + JWT `registered` bekler. */
export async function ensureMuhabbetTripSocketReady(myUserId: string, timeoutMs: number): Promise<boolean> {
  const myLo = (myUserId || '').trim().toLowerCase();
  if (!myLo) return false;
  const started = Date.now();
  const budget = () => Math.max(0, timeoutMs - (Date.now() - started));

  notifyAuthTokenBecameAvailableForSocket();
  const socket = getOrCreateSocket();
  if (!(await waitSocketConnected(socket, Math.min(budget(), timeoutMs)))) {
    return false;
  }
  if (isMuhabbetSocketRegisteredForUser(socket, myLo)) {
    return true;
  }
  while (Date.now() - started < timeoutMs) {
    const slice = Math.min(900, budget());
    if (slice <= 0) break;
    notifyAuthTokenBecameAvailableForSocket();
    await waitForNextRegisterSuccess(socket, slice);
    if (isMuhabbetSocketRegisteredForUser(socket, myLo)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return isMuhabbetSocketRegisteredForUser(socket, myLo);
}
