export const resolveGeoAndEvents = (countryCode = 'AR', date = new Date()) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const isSouth = ['AR', 'CL', 'UY', 'BR', 'AU', 'ZA'].includes(countryCode);
  const season = isSouth 
    ? (month === 12 || month <= 2 ? 'Verano' : (month >= 6 && month <= 8 ? 'Invierno' : 'Ambas'))
    : (month >= 6 && month <= 8 ? 'Verano' : (month === 12 || month <= 2 ? 'Invierno' : 'Ambas'));

  const events = [];
  if (month === 2 && day === 14 && countryCode !== 'CO' && countryCode !== 'BR') {
    events.push({ id: 'SAN_VALENTIN', target: 'Mujer', discount: 15, theme: 'valentine' });
  }
  if (countryCode === 'MX' && month === 11 && (day === 1 || day === 2)) {
    events.push({ id: 'DIA_DE_MUERTOS', target: 'Todos', discount: 20, theme: 'muertos' });
  }

  return { countryCode, season, activeEvents: events };
};
