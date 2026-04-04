'use client';

import React from 'react';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { CalendarEvent, HolidayInfo } from '@/app/types/holiday';

interface CalendarViewProps {
  events: CalendarEvent[];
  onHolidayClick: (holiday: HolidayInfo) => void;
}

export default function CalendarView({
  events,
  onHolidayClick,
}: CalendarViewProps) {
  const handleEventClick = (info: EventClickArg) => {
    const event = info.event;
    const props = event.extendedProps;
    onHolidayClick({
      title: event.title,
      date: event.startStr,
      type: props.type,
      description: props.description,
      day: props.day,
    });
  };

  const renderEventContent = (eventInfo: EventContentArg) => (
    <div className="fc-event-content" style={{ padding: '2px 4px' }}>
      <div
        className="fc-event-title"
        style={{ fontSize: '12px', fontWeight: '600' }}
      >
        {eventInfo.event.title}
      </div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        .fc {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        .fc-toolbar-title {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: #1f2937;
        }
        .fc-button {
          background-color: #3b82f6 !important;
          border-color: #3b82f6 !important;
          text-transform: capitalize !important;
          border-radius: 6px !important;
          padding: 4px 10px !important;
          font-weight: 500 !important;
          font-size: 13px !important;
          margin-right: 4px !important;
        }
        .fc-button:hover {
          background-color: #2563eb !important;
          border-color: #2563eb !important;
        }
        .fc-button-active {
          background-color: #1e40af !important;
          border-color: #1e40af !important;
        }
        .fc-daygrid-day {
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .fc-daygrid-day:hover {
          background-color: #f3f4f6;
        }
        .fc-day-sat,
        .fc-day-sun {
          background-color: #fef3c7;
        }
        .fc-event {
          border-radius: 4px;
          padding: 2px 4px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .fc-event:hover {
          transform: scale(1.05);
        }
        .fc-daygrid-event {
          white-space: normal !important;
          align-items: flex-start !important;
        }
        .fc-list-event-title {
          font-weight: 500;
        }
        .fc-daygrid-day-number {
          color: #111827 !important;
          opacity: 1 !important;
          font-weight: 500;
        }
        .fc-col-header-cell-cushion {
          color: #111827 !important;
          opacity: 1 !important;
          font-weight: 600;
          text-decoration: none !important;
        }
        .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          color: #1d4ed8 !important;
          font-weight: 700;
        }
        .fc-list-event-title a,
        .fc-list-day-text,
        .fc-list-day-side-text {
          color: #111827 !important;
          opacity: 1 !important;
        }
        .fc-day-other .fc-daygrid-day-number {
          color: #9ca3af !important;
        }

        /* ---- Mobile responsive ---- */
        @media (max-width: 640px) {
          .fc {
            padding: 8px 4px;
          }
          .fc-toolbar {
            flex-direction: column !important;
            gap: 8px !important;
            align-items: flex-start !important;
          }
          .fc-toolbar-chunk {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          .fc-toolbar-title {
            font-size: 1rem !important;
          }
          .fc-button {
            padding: 3px 7px !important;
            font-size: 11px !important;
          }
          .fc-daygrid-day-number {
            font-size: 11px;
          }
          .fc-event-title {
            font-size: 10px !important;
          }
          .fc-col-header-cell-cushion {
            font-size: 11px;
          }
          .fc-daygrid-day-top {
            flex-direction: row;
          }
        }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,listMonth',
        }}
        events={events}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        height="auto"
        firstDay={1}
        weekends={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '18:00',
        }}
      />
    </>
  );
}
