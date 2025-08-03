import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

// services/accidents.js
export const getYears = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/accidents/years`);
    // Asegúrate de que la respuesta es un array
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.error('Error en getYears:', err);
    return []; // Siempre devuelve un array
  }
};

export const getFilterOptions = async () => {
    const response = await axios.get(`${API_BASE_URL}/api/accidents/filter-options`);
    return response.data;
};

export const getChartData = async (accidentType, segmentType, year) => {
    const response = await axios.get(`${API_BASE_URL}/api/accidents/${accidentType}/${segmentType}`, {
        params: { year }
    });
    return response.data;
};

export const getSummaryData = async (year) => {
  const response = await axios.get(`${API_BASE_URL}/api/accidents/summary`, {
    params: { year }
  });
  return response.data;
};

export const getMultiYearData = async (accidentType, segmentType) => {
    const response = await axios.get(`${API_BASE_URL}/api/accidents/multi-year`, {
        params: { accidentType, segmentType }
    });
    return response.data;
};