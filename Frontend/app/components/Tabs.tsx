"use client";

import React from 'react';

interface TabItem {
  id: string;
  label: string;
  count?: number | string;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function Tabs({ items, activeId, onChange }: TabsProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: isActive ? '1px solid #3b82f6' : '1px solid #e5e7eb',
              backgroundColor: isActive ? '#e0f2fe' : '#ffffff',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isActive ? '0 2px 6px rgba(59, 130, 246, 0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                style={{
                  minWidth: '28px',
                  padding: '4px 8px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? '#3b82f6' : '#f3f4f6',
                  color: isActive ? '#ffffff' : '#111827',
                  fontSize: '12px',
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
