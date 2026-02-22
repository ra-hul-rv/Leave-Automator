'use client';

import React from 'react';
import { getTypeColor, getTypeLabel, formatShortDate } from '@/app/lib/utils';
import type { HolidayInfo } from '@/app/types/holiday';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday: HolidayInfo | null;
}

export default function HolidayModal({
  isOpen,
  onClose,
  holiday,
}: HolidayModalProps) {
  if (!isOpen || !holiday) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: getTypeColor(holiday.type),
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {getTypeLabel(holiday.type)}
            </div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1f2937',
                margin: '8px 0',
              }}
            >
              {holiday.title}
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0' }}>
              {formatShortDate(holiday.date, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '8px',
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.backgroundColor = '#2563eb')
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = '#3b82f6')
          }
        >
          Close
        </button>
      </div>
    </div>
  );
}
