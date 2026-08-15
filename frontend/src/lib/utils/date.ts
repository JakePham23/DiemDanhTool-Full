export const formatDate = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

export const getDefaultFromDate = (todayStr: string): string => {
    const [day, month, year] = todayStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const currentDayOfWeek = date.getDay(); 
    let daysToSubtract = 0;

    if (currentDayOfWeek === 4 || currentDayOfWeek === 0) {
        daysToSubtract = 0; 
    } else if (currentDayOfWeek > 4) { 
        daysToSubtract = currentDayOfWeek - 4;
    } else { 
        daysToSubtract = currentDayOfWeek;
    }
    
    date.setDate(date.getDate() - daysToSubtract);
    return formatDate(date);
};