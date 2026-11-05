import assert from 'node:assert/strict';
import {parseCalendar} from './dist/calendar.js';
const raw=`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nodo//Calendar Test//ES
BEGIN:VEVENT
UID:daily
SUMMARY:Reunión diaria
DTSTART;TZID=America/Mexico_City:20261104T090000
DTEND;TZID=America/Mexico_City:20261104T100000
RRULE:FREQ=DAILY;COUNT=4
EXDATE;TZID=America/Mexico_City:20261106T090000
END:VEVENT
BEGIN:VEVENT
UID:daily
RECURRENCE-ID;TZID=America/Mexico_City:20261107T090000
SUMMARY:Reunión movida
DTSTART;TZID=America/Mexico_City:20261107T110000
DTEND;TZID=America/Mexico_City:20261107T120000
END:VEVENT
BEGIN:VEVENT
UID:all-day
SUMMARY:Fecha personal
DTSTART;VALUE=DATE:20261105
DTEND;VALUE=DATE:20261106
END:VEVENT
BEGIN:VEVENT
UID:cancelled
SUMMARY:Cancelada
STATUS:CANCELLED
DTSTART:20261105T180000Z
DTEND:20261105T190000Z
END:VEVENT
BEGIN:VEVENT
UID:medical
SUMMARY:Prueba médica
DTSTART:20261105T200000Z
DTEND:20261105T210000Z
END:VEVENT
BEGIN:VEVENT
UID:test
SUMMARY:Prueba de aviso — Nodo
DTSTART:20261105T210000Z
DTEND:20261105T220000Z
END:VEVENT
END:VCALENDAR`;
const {events}=await parseCalendar(raw,new Date('2026-11-05T18:00:00Z'));
const daily=events.filter(e=>e.id.startsWith('daily|'));assert.equal(daily.length,3);assert.ok(daily.some(e=>e.start==='2026-11-05T15:00:00.000Z'));assert.ok(!daily.some(e=>e.start.startsWith('2026-11-06')));assert.ok(daily.some(e=>e.start==='2026-11-07T17:00:00.000Z'&&e.title==='Reunión movida'));
assert.ok(!events.some(e=>e.title==='Cancelada'));
assert.deepEqual(events.find(e=>e.id.startsWith('all-day|'))?.start,'2026-11-05');assert.equal(events.find(e=>e.id.startsWith('all-day|'))?.end,'2026-11-06');
assert.equal(events.find(e=>e.title==='Prueba médica')?.category,'meeting');assert.equal(events.find(e=>e.title.startsWith('Prueba de aviso'))?.category,'test');
await assert.rejects(()=>parseCalendar('no calendar'));
await assert.rejects(()=>parseCalendar(raw.replace('FREQ=DAILY;COUNT=4','FREQ=SECONDLY;COUNT=9999999')));
console.log(JSON.stringify({calendar_parser_checks:11,passed:true}));
