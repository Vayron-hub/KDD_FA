import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid,
  FormControl, InputLabel, Select, MenuItem,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  getYears,
  getChartData,
  getSummaryData,
  getMultiYearData
} from './services/accidentes';
import ChartRenderer from './components/CharterRender';

const AccidentDashboard = () => {
  const [year, setYear] = useState(null);
  const [years, setYears] = useState([]);
  const [accidentType, setAccidentType] = useState('non-fatal');
  const [segmentType, setSegmentType] = useState('age');
  const [chartData, setChartData] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('single'); // 'single' o 'multi'

  // Cargar años disponibles
  useEffect(() => {
    const loadYears = async () => {
      try {
        const yearsData = await getYears();
        // Asegúrate de que yearsData es un array antes de setearlo
        if (Array.isArray(yearsData)) {
          setYears(yearsData);
          if (yearsData.length > 0) {
            setYear(yearsData[0]);
          }
        } else {
          // Si no es array, conviértelo o maneja el error
          console.error('Los años recibidos no son un array:', yearsData);
          setYears([]);
          setError('Formato de datos inválido para años');
        }
      } catch (err) {
        console.error('Error al cargar años:', err);
        setError('Error al cargar años disponibles');
        setYears([]); // Asegura que years sigue siendo array
      }
    };
    loadYears();
  }, []);

  // Cargar datos según la selección
  useEffect(() => {
    if (!year || !accidentType || !segmentType) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (viewMode === 'single') {
          const [chartRes, summaryRes] = await Promise.all([
            getChartData(accidentType, segmentType, year),
            getSummaryData(year)
          ]);
          setChartData(chartRes.data);
          setSummaryData({
            fatal: summaryRes.data?.fatal || summaryRes.data?.Fatal || 0,
            nonFatal: summaryRes.data?.nonFatal || summaryRes.data?.['Non-fatal'] || 0
          });
        } else {
          const multiYearRes = await getMultiYearData(accidentType, segmentType);
          setChartData(multiYearRes.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [year, accidentType, segmentType, viewMode]);

  const segmentOptions = accidentType === 'fatal' ? [
    { value: 'industry', label: 'Industria' },
    { value: 'accident-type', label: 'Tipo de Accidente' },
    { value: 'demographic', label: 'Demográfico' },
    { value: 'occupation', label: 'Ocupación' }
  ] : [
    { value: 'age', label: 'Edad' },
    { value: 'gender', label: 'Género' },
    { value: 'industry', label: 'Industria' },
    { value: 'severity', label: 'Gravedad' },
    { value: 'occupation', label: 'Ocupación' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <div style={{ width: '100%' }}>

        <Typography sx={{ fontWeight: 'bold' }} variant="h4" gutterBottom>
          Dashboard de Accidentes Laborales
        </Typography>


        {viewMode === 'single' && (
          <Paper sx={{ p: 2, mb: 3,  }}>
            <Typography variant="h3" gutterBottom>
              Resumen {year}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sx={{ display: 'flex' }}>
                <Typography>Accidentes Fatales: </Typography>
                <Typography sx={{fontWeight: 'bold'}}> {summaryData.fatal || 0} </Typography>
              </Grid>
              <Grid item xs={6} sx={{ display: 'flex' }}>
                <Typography>Accidentes No Fatales: </Typography>
                <Typography sx={{fontWeight: 'bold'}}> {summaryData.nonFatal || 0} </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Paper sx={{ p: 2, mb: 3,  }}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={accidentType}
                  onChange={(e) => {
                    setAccidentType(e.target.value);
                    setSegmentType(e.target.value === 'fatal' ? 'industry' : 'age');
                  }}
                >
                  <MenuItem value="non-fatal">No Fatales</MenuItem>
                  <MenuItem value="fatal">Fatales</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Segmentación</InputLabel>
                <Select
                  value={segmentType}
                  onChange={(e) => setSegmentType(e.target.value)}
                >
                  {segmentOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Año</InputLabel>
                <Select
                  value={year || ''}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={viewMode === 'multi' || years.length === 0}
                >
                  {Array.isArray(years) && years.map(y => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                fullWidth
              >
                <ToggleButton value="single" disabled={!year}>
                  Vista por Año
                </ToggleButton>
                <ToggleButton value="multi">
                  Vista Multi-Año
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Paper>
        <Paper sx={{ p: 2,  }} >
          <Typography variant="h6" gutterBottom>
            {accidentType === 'fatal' ? 'Accidentes Fatales' : 'Accidentes No Fatales'} -
            {viewMode === 'multi' ? ' Evolución por Años' : ` Segmentación por ${segmentOptions.find(opt => opt.value === segmentType)?.label} (${year})`}
          </Typography>

          <ChartRenderer
            data={chartData}
            segmentType={segmentType}
            loading={loading}
            error={error}
            isMultiYear={viewMode === 'multi'}
          />
        </Paper>
      </div>
    </Box>
  );
};

export default AccidentDashboard;