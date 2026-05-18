import React from 'react';
import LeylekAIFloating from '../components/LeylekAIFloating';

/** Rol seçimi — Leylek AI ipucu (app/index.tsx rol alanında kullanılır). */
export function RoleSelectLeylekAIFloating() {
  return (
    <LeylekAIFloating
      position="center-bottom"
      visualPreset="roleCockpit"
      message="Leylek'e sor. Sana en iyi seçeneği bulmama yardım edeyim."
    />
  );
}
