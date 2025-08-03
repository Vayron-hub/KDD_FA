import React from 'react';
import {
  BarChart,
  PieChart,
  LineChart,
  ScatterChart
} from '@mui/x-charts';
import { Box, CircularProgress, Alert } from '@mui/material';

const ChartRenderer = ({ 
  data, 
  segmentType, 
  loading, 
  error,
  isMultiYear = false
}) => {
  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || data.length === 0) return <Alert severity="info">No hay datos disponibles</Alert>;

  const chartProps = {
    width: 600,
    height: 400,
    margin: { top: 30, right: 30, bottom: 80, left: 80 }
  };

  const renderChart = () => {
    if (isMultiYear) {
      // Procesar datos para múltiples años
      const years = [...new Set(data.map(item => item.year))];
      const seriesData = {};
      
      data.forEach(item => {
        if (!seriesData[item.label]) {
          seriesData[item.label] = Array(years.length).fill(0);
        }
        const yearIndex = years.indexOf(item.year);
        seriesData[item.label][yearIndex] = item.value;
      });
      
      return (
        <LineChart
          {...chartProps}
          xAxis={[{
            data: years,
            label: 'Año',
            scaleType: 'point'
          }]}
          series={Object.keys(seriesData).map(label => ({
            data: seriesData[label],
            label,
            curve: 'linear'
          }))}
        />
      );
    }

    switch (segmentType) {
      case 'age':
      case 'industry':
      case 'occupation':
        return (
          <BarChart
            {...chartProps}
            series={[{ data: data.map(item => item.value) }]}
            xAxis={[{
              data: data.map(item => item.label),
              scaleType: 'band',
              label: segmentType === 'age' ? 'Grupo de Edad' : 
                    segmentType === 'industry' ? 'Industria' : 'Ocupación'
            }]}
            yAxis={[{ label: 'Número de Accidentes' }]}
          />
        );
      case 'gender':
      case 'demographic':
        return (
          <PieChart
            {...chartProps}
            series={[{
              data: data.map(item => ({
                id: item.label,
                value: item.value,
                label: item.label
              })),
              innerRadius: 30,
              outerRadius: 120,
              paddingAngle: 5,
              cornerRadius: 5,
            }]}
          />
        );
      case 'severity':
        return (
          <ScatterChart
            {...chartProps}
            series={[{
              data: data.map((item, index) => ({
                x: index,
                y: item.value,
                label: item.label,
                id: item.label
              })),
              label: 'Gravedad de Accidentes'
            }]}
            xAxis={[{
              data: data.map(item => item.label),
              label: 'Nivel de Gravedad'
            }]}
            yAxis={[{ label: 'Número de Accidentes' }]}
          />
        );
      default:
        return <BarChart {...chartProps} />;
    }
  };

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      {renderChart()}
    </Box>
  );
};

export default ChartRenderer;  
