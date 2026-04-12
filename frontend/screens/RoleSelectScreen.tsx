import React from 'react';
import LeylekAIFloating from '../components/LeylekAIFloating';

/** Rol seçimi — Leylek AI ipucu (app/index.tsx rol alanında kullanılır). */
export function RoleSelectLeylekAIFloating() {
  return (
    <LeylekAIFloating
      position="center-bottom"
      message="Leylek'e sor. Sürücü olmak için şartları öğrenmek ister misin?"
    />
  );
}
