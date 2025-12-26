/**
 * Events Page Functionality
 * Handles event display, calendar, and modal
 */

let allEvents = [];
let currentDate = new Date();
let eventDates = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadEvents();
    initCalendar();
    setupModal();
    setupEventCardClicks();
});

function setupEventCardClicks() {
    const container = document.getElementById('events-list');
    if (container) {
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card');
            if (card) {
                const eventId = parseInt(card.dataset.eventId);
                openEventModal(eventId);
            }
        });
    }
}

async function loadEvents() {
    try {
        const response = await fetch('data/events.json');
        allEvents = await response.json();

        const now = new Date();
        const upcoming = allEvents.filter(e => new Date(e.date) >= now);
        const past = allEvents.filter(e => new Date(e.date) < now);

        eventDates = allEvents.map(e => e.date);

        renderUpcomingEvents(upcoming);
        renderPastEvents(past);
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('no-events').classList.remove('hidden');
    }
}

function renderUpcomingEvents(events) {
    const container = document.getElementById('events-list');
    const noEvents = document.getElementById('no-events');

    if (events.length === 0) {
        noEvents.classList.remove('hidden');
        return;
    }

    container.innerHTML = events.map(event => `
        <article class="bg-gray-900 rounded-lg overflow-hidden group cursor-pointer event-card" data-event-id="${event.id}">
            <div class="flex flex-col sm:flex-row">
                <div class="sm:w-48 flex-shrink-0">
                    ${event.image
                        ? `<img src="${event.image}" alt="${event.title}" class="w-full h-full object-cover aspect-video sm:aspect-square">`
                        : `<div class="aspect-video sm:aspect-square bg-gradient-to-br from-soft-blue/20 to-pastel-pink/10 group-hover:from-soft-blue/30 transition-colors"></div>`
                    }
                </div>
                <div class="p-6 flex-1">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <span class="text-soft-blue text-sm">${formatDate(event.date)}</span>
                            <h3 class="font-serif text-xl font-semibold mt-1 group-hover:text-soft-blue transition-colors">${event.title}</h3>
                        </div>
                        <svg class="w-5 h-5 text-gray-600 group-hover:text-soft-blue transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                    <p class="text-gray-400 text-sm mt-2 line-clamp-2">${event.description}</p>
                    <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            </svg>
                            ${event.location}
                        </span>
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            ${event.time}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    `).join('');
}

function renderPastEvents(events) {
    const container = document.getElementById('past-events');

    if (events.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-2">No past events yet.</p>';
        return;
    }

    container.innerHTML = events.slice(0, 4).map(event => `
        <div class="bg-gray-900/50 rounded-lg p-4">
            <span class="text-gray-500 text-sm">${formatDate(event.date)}</span>
            <h4 class="font-medium mt-1">${event.title}</h4>
            <p class="text-sm text-gray-500 mt-1">${event.location}</p>
        </div>
    `).join('');
}

function initCalendar() {
    renderCalendar();

    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
}

function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let calendarHTML = '';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="py-2"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        const hasEvent = eventDates.includes(dateStr);

        let classes = 'py-2 rounded-full cursor-default';
        if (isToday) classes += ' bg-white text-black font-medium';
        else if (hasEvent) classes += ' bg-soft-blue text-black font-medium';
        else classes += ' text-gray-400';

        calendarHTML += `<div class="${classes}">${day}</div>`;
    }

    document.getElementById('calendar-days').innerHTML = calendarHTML;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function setupModal() {
    const modal = document.getElementById('event-modal');
    const overlay = document.getElementById('event-modal-overlay');
    const closeBtn = document.getElementById('close-event-modal');

    overlay.addEventListener('click', closeEventModal);
    closeBtn.addEventListener('click', closeEventModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeEventModal();
        }
    });
}

function openEventModal(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('modal-event-title').textContent = event.title;
    document.getElementById('modal-event-date').textContent = formatDate(event.date);
    document.getElementById('modal-event-description').textContent = event.description;
    document.getElementById('modal-event-location').textContent = event.location;
    document.getElementById('modal-event-address').textContent = event.address || '';
    document.getElementById('modal-event-time').textContent = event.time;

    // Set modal image
    const modalImage = document.getElementById('modal-event-image');
    if (event.image) {
        modalImage.innerHTML = `<img src="${event.image}" alt="${event.title}" class="w-full h-full object-cover aspect-video">`;
    } else {
        modalImage.innerHTML = '';
        modalImage.className = 'aspect-video bg-gradient-to-br from-gray-800 to-gray-900';
    }

    // Generate Google Calendar link
    const startDate = new Date(event.date + 'T' + event.time.split(' - ')[0].replace(/[^0-9:]/g, ''));
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Assume 3 hour events

    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate.toISOString().replace(/-|:|\.\d+/g, '')}/${endDate.toISOString().replace(/-|:|\.\d+/g, '')}&location=${encodeURIComponent(event.address || event.location)}&details=${encodeURIComponent(event.description)}`;

    document.getElementById('modal-calendar-link').href = googleCalUrl;

    // Generate Apple Calendar (ICS) link
    const formatICSDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, -1);
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fidget Street//Events//EN
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, '\\n')}
LOCATION:${event.address || event.location}
END:VEVENT
END:VCALENDAR`;

    const icsBlob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const icsUrl = URL.createObjectURL(icsBlob);
    document.getElementById('modal-apple-calendar-link').href = icsUrl;
    document.getElementById('event-modal').classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('event-modal').classList.add('hidden');
}

// Make functions globally available for onclick handlers
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
