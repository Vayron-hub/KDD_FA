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
        // Validación inicial de datos
        if (!data || !Array.isArray(data) || data.length === 0) {
            return (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    No hay datos disponibles para mostrar
                </Alert>
            );
        }

        // Filtrar y validar datos
        const validData = data.filter(item =>
            item &&
            item.label !== undefined &&
            item.value !== undefined &&
            !isNaN(item.value)
        );

        if (validData.length === 0) {
            return (
                <Alert severity="error" sx={{ mt: 2 }}>
                    Los datos no tienen el formato correcto
                </Alert>
            );
        }

        if (isMultiYear) {
            try {
                // Procesar datos para múltiples años con validación
                const years = [...new Set(validData.map(item => item.year))].sort();
                const seriesData = {};

                validData.forEach(item => {
                    if (!seriesData[item.label]) {
                        seriesData[item.label] = Array(years.length).fill(0);
                    }
                    const yearIndex = years.indexOf(item.year);
                    if (yearIndex !== -1) {
                        seriesData[item.label][yearIndex] = item.value;
                    }
                });

                const series = Object.keys(seriesData).map(label => ({
                    data: seriesData[label],
                    label,
                    curve: 'linear'
                }));

                return (
                    <LineChart
                        {...chartProps}
                        xAxis={[{
                            data: years,
                            label: 'Año',
                            scaleType: 'point'
                        }]}
                        series={series}
                    />
                );
            } catch (err) {
                console.error('Error al renderizar gráfico multi-año:', err);
                return (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        Error al procesar datos temporales
                    </Alert>
                );
            }
        }

        // Preparar datos comunes para gráficos
        const chartSeries = [{
            data: validData.map(item => Number(item.value)),
            label: getChartLabel(segmentType)
        }];

        const commonBarProps = {
            ...chartProps,
            series: chartSeries,
            yAxis: [{ label: 'Número de Accidentes' }]
        };

        switch (segmentType) {
            case 'age':
            case 'industry':
            case 'occupation':
            case 'accident-type':
                return (
                    <BarChart
                        {...commonBarProps}
                        xAxis={[{
                            data: validData.map(item => String(item.label)),
                            scaleType: 'band',
                            label: getChartLabel(segmentType)
                        }]}
                    />
                );

            case 'gender':
            case 'demographic':
                return (
                    <PieChart
                        {...chartProps}
                        series={[{
                            data: validData.map(item => ({
                                id: item.label,
                                value: Number(item.value),
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
                            data: validData.map((item, index) => ({
                                x: index,
                                y: Number(item.value),
                                label: item.label,
                                id: item.label
                            })),
                            label: 'Gravedad de Accidentes'
                        }]}
                        xAxis={[{
                            data: validData.map(item => item.label),
                            label: 'Nivel de Gravedad'
                        }]}
                        yAxis={[{ label: 'Número de Accidentes' }]}
                    />
                );

            default:
                return (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Tipo de segmentación no soportado: {segmentType}
                    </Alert>
                );
        }
    };

    // Función auxiliar para obtener etiquetas
    const getChartLabel = (segmentType) => {
        const labels = {
            'age': 'Grupo de Edad',
            'industry': 'Industria',
            'occupation': 'Ocupación',
            'gender': 'Género',
            'demographic': 'Grupo Demográfico',
            'accident-type': 'Tipo de Accidente',  // Nueva entrada
            'event-type': 'Tipo de Evento'
        };
        return labels[segmentType] || 'Datos';
    };

    return (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            {renderChart()}
        </Box>
    );
};

export default ChartRenderer;  
