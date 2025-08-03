const express = require('express');
const sql = require('mssql');
const router = express.Router();

// Helper mejorado para consultas con manejo de errores
const executeQuery = async (db, query, params = {}) => {
    try {
        const request = db.request();
        Object.entries(params).forEach(([key, value]) => {
            request.input(key, typeof value === 'number' ? sql.Int : sql.NVarChar, value);
        });
        const result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('Error en executeQuery:', err);
        throw err;
    }
};

// Middleware para validar año
const validateYear = (req, res, next) => {
    const year = req.query.year;  // Ahora solo busca en query params

    if (!year || isNaN(year)) {
        return res.status(400).json({
            error: 'El parámetro year es requerido y debe ser un número',
            received: year,
            details: 'Debe proporcionar el parámetro year como query parameter (ej: ?year=2023)'
        });
    }

    req.validatedYear = parseInt(year);
    next();
};
// Obtener años disponibles
router.get('/years', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT year 
            FROM (
                SELECT year FROM fatal_accidents
                UNION
                SELECT year FROM non_fatal_accidents
            ) AS years
            ORDER BY year DESC`;

        const result = await executeQuery(req.app.locals.db, query);
        const years = result.map(item => item.year);

        res.json(years);
    } catch (err) {
        console.error('GET /years:', err);
        res.status(500).json({
            error: 'Error al obtener años',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Datos consolidados multi-año
router.get('/multi-year', async (req, res) => {
    const { accidentType = 'non-fatal', segmentType = 'age' } = req.query;

    if (!['fatal', 'non-fatal'].includes(accidentType)) {
        return res.status(400).json({
            error: 'Tipo de accidente no válido',
            validOptions: ['fatal', 'non-fatal']
        });
    }

    try {
        let query;
        const table = accidentType === 'fatal' ? 'fatal_accidents' : 'non_fatal_accidents';

        // Consultas parametrizadas
        const queries = {
            'fatal': {
                'industry': `SELECT i.industry_name AS label, f.year, COUNT(*) AS value
                FROM fatal_accidents f
                JOIN industries i ON f.industry_id = i.industry_id
                GROUP BY i.industry_name, f.year
                ORDER BY f.year, value DESC`,

                'accident-type': `SELECT e.event_name AS label, f.year, COUNT(*) AS value
                     FROM fatal_accidents f
                     JOIN event_types e ON f.event_id = e.event_id
                     GROUP BY e.event_name, f.year
                     ORDER BY f.year, value DESC`,

                'demographic': `SELECT d.group_name AS label, f.year, COUNT(*) AS value
                   FROM fatal_accidents f
                   JOIN demographics d ON f.demographic_id = d.demographic_id
                   GROUP BY d.group_name, f.year
                   ORDER BY f.year, value DESC`,

                'occupation': `SELECT o.occupation_name AS label, f.year, COUNT(*) AS value
                  FROM fatal_accidents f
                  JOIN occupations o ON f.occupation_id = o.occupation_id
                  GROUP BY o.occupation_name, f.year
                  ORDER BY f.year, value DESC`,

                'age': `SELECT a.age_range AS label, f.year, COUNT(*) AS value
            FROM fatal_accidents f
            JOIN age_groups a ON f.age_group_id = a.age_group_id
            GROUP BY a.age_range, a.age_group_id, f.year
            ORDER BY f.year, a.age_group_id`,

                'gender': `SELECT 
                  CASE 
                      WHEN f.gender IS NULL THEN 'No especificado'
                      ELSE f.gender
                  END AS label, 
                  f.year, 
                  COUNT(*) AS value
               FROM fatal_accidents f
               GROUP BY f.gender, f.year
               ORDER BY f.year, value DESC`,

                'severity': `SELECT 
                    'Fatal' AS label, 
                    f.year, 
                    COUNT(*) AS value
                 FROM fatal_accidents f
                 GROUP BY f.year
                 ORDER BY f.year`
            },
            'non-fatal': {
                'age': `SELECT a.age_range AS label, n.year, COUNT(*) AS value
        FROM non_fatal_accidents n
        JOIN age_groups a ON n.age_group_id = a.age_group_id
        GROUP BY a.age_range, a.age_group_id, n.year
        ORDER BY n.year, a.age_group_id`,

                'gender': `SELECT n.gender AS label, n.year, COUNT(*) AS value
               FROM non_fatal_accidents n
               WHERE n.gender IS NOT NULL
               GROUP BY n.gender, n.year
               ORDER BY n.year, value DESC`,

                'industry': `SELECT i.industry_name AS label, n.year, COUNT(*) AS value
                FROM non_fatal_accidents n
                JOIN industries i ON n.industry_id = i.industry_id
                GROUP BY i.industry_name, n.year
                ORDER BY n.year, value DESC`,

                'severity': `SELECT s.level_name AS label, n.year, COUNT(*) AS value
                FROM non_fatal_accidents n
                JOIN severity_levels s ON n.severity_id = s.severity_id
                GROUP BY s.level_name, n.year,  s.severity_id
                ORDER BY n.year, s.severity_id`,

                'occupation': `SELECT o.occupation_name AS label, n.year, COUNT(*) AS value
                  FROM non_fatal_accidents n
                  JOIN occupations o ON n.occupation_id = o.occupation_id
                  GROUP BY o.occupation_name, n.year
                  ORDER BY n.year, value DESC`,

                'days-lost': `SELECT 
                     CASE 
                         WHEN n.days_lost <= 3 THEN '1-3 días'
                         WHEN n.days_lost <= 7 THEN '4-7 días'
                         WHEN n.days_lost <= 14 THEN '8-14 días'
                         WHEN n.days_lost <= 30 THEN '15-30 días'
                         ELSE 'Más de 30 días'
                     END AS label,
                     n.year,
                     COUNT(*) AS value
                  FROM non_fatal_accidents n
                  GROUP BY label, n.year
                  ORDER BY n.year,
                    CASE label
                        WHEN '1-3 días' THEN 1
                        WHEN '4-7 días' THEN 2
                        WHEN '8-14 días' THEN 3
                        WHEN '15-30 días' THEN 4
                        ELSE 5
                    END`,

                'event-type': `SELECT e.event_name AS label, n.year, COUNT(*) AS value
                  FROM non_fatal_accidents n
                  JOIN event_types e ON n.event_id = e.event_id
                  GROUP BY e.event_name, n.year
                  ORDER BY n.year, value DESC`
            }
        };

        query = queries[accidentType][segmentType];

        if (!query) {
            return res.status(400).json({
                error: 'Segmentación no válida',
                validOptions: Object.keys(queries[accidentType])
            });
        }

        const data = await executeQuery(req.app.locals.db, query);
        res.json({
            status: 'success',
            accidentType,
            segmentType,
            count: data.length,
            data
        });
    } catch (err) {
        console.error(`GET /multi-year:`, err);
        res.status(500).json({
            error: 'Error al obtener datos',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Obtener opciones de filtros
router.get('/filter-options', async (req, res) => {
    try {
        const db = req.app.locals.db;

        const options = {
            industries: 'SELECT industry_id AS value, industry_name AS label FROM industries ORDER BY industry_name',
            events: 'SELECT event_id AS value, event_name AS label FROM event_types ORDER BY event_name',
            demographics: 'SELECT demographic_id AS value, group_name AS label FROM demographics ORDER BY group_name',
            ageGroups: 'SELECT age_group_id AS value, age_range AS label FROM age_groups ORDER BY age_group_id',
            occupations: 'SELECT occupation_id AS value, occupation_name AS label FROM occupations ORDER BY occupation_name',
            severities: 'SELECT severity_id AS value, level_name AS label FROM severity_levels ORDER BY severity_id'
        };

        const results = await Promise.all(
            Object.values(options).map(sql => executeQuery(db, sql))
        );

        res.json(Object.fromEntries(
            Object.keys(options).map((key, index) => [key, results[index]])
        ));
    } catch (err) {
        console.error('GET /filter-options:', err);
        res.status(500).json({
            error: 'Error al obtener opciones',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Endpoint para segmentaciones
router.get('/:accidentType/:segmentType', validateYear, async (req, res) => {
    const { accidentType, segmentType } = req.params;
    const year = req.validatedYear;

    const segmentMapping = {
    'accident-type': 'event-type'  // Normaliza a como está en la base de datos
  };
  
  const normalizedSegment = segmentMapping[segmentType] || segmentType; 

    // Validación manual del accidentType
    if (!['fatal', 'non-fatal'].includes(accidentType)) {
        return res.status(400).json({
            error: 'Tipo de accidente no válido',
            validOptions: ['fatal', 'non-fatal']
        });
    }

    try {
        const queries = {
            'fatal': {
                'industry': `SELECT i.industry_name AS label, COUNT(*) AS value
                FROM fatal_accidents f
                JOIN industries i ON f.industry_id = i.industry_id
                WHERE f.year = @year
                GROUP BY i.industry_name
                ORDER BY value DESC`,  // Top 10 industrias

                'accident-type': `SELECT e.event_name AS label, COUNT(*) AS value
                     FROM fatal_accidents f
                     JOIN event_types e ON f.event_id = e.event_id
                     WHERE f.year = @year
                     GROUP BY e.event_name
                     ORDER BY value DESC`,

                'demographic': `SELECT d.group_name AS label, COUNT(*) AS value
                   FROM fatal_accidents f
                   JOIN demographics d ON f.demographic_id = d.demographic_id
                   WHERE f.year = @year
                   GROUP BY d.group_name
                   ORDER BY value DESC`,

                'occupation': `SELECT o.occupation_name AS label, COUNT(*) AS value
                  FROM fatal_accidents f
                  JOIN occupations o ON f.occupation_id = o.occupation_id
                  WHERE f.year = @year
                  GROUP BY o.occupation_name
                  ORDER BY value DESC`,  // Top 10 ocupaciones

                'age': `SELECT a.age_range AS label, COUNT(*) AS value
        FROM fatal_accidents f
        JOIN age_groups a ON f.age_group_id = a.age_group_id
        WHERE f.year = @year
        GROUP BY a.age_range, a.age_group_id
        ORDER BY a.age_group_id`
            },
            'non-fatal': {
                'age': `SELECT a.age_range AS label, COUNT(*) AS value
        FROM non_fatal_accidents n
        JOIN age_groups a ON n.age_group_id = a.age_group_id
        WHERE n.year = @year
        GROUP BY a.age_range, a.age_group_id
        ORDER BY a.age_group_id`,

                'gender': `SELECT n.gender AS label, COUNT(*) AS value
               FROM non_fatal_accidents n
               WHERE n.year = @year AND n.gender IS NOT NULL
               GROUP BY n.gender
               ORDER BY value DESC`,

                'industry': `SELECT i.industry_name AS label, COUNT(*) AS value
                FROM non_fatal_accidents n
                JOIN industries i ON n.industry_id = i.industry_id
                WHERE n.year = @year
                GROUP BY i.industry_name
                ORDER BY value DESC
                `,  // Top 10 industrias

                'severity': `SELECT s.level_name AS label, COUNT(*) AS value
                FROM non_fatal_accidents n
                JOIN severity_levels s ON n.severity_id = s.severity_id
                WHERE n.year = @year
                GROUP BY s.level_name, s.severity_id
                ORDER BY s.severity_id`,

                'occupation': `SELECT o.occupation_name AS label, COUNT(*) AS value
                  FROM non_fatal_accidents n
                  JOIN occupations o ON n.occupation_id = o.occupation_id
                  WHERE n.year = @year
                  GROUP BY o.occupation_name
                  ORDER BY value DESC
                  `,  // Top 10 ocupaciones

                'days-lost': `SELECT 
                    CASE 
                        WHEN n.days_lost <= 3 THEN '1-3 días'
                        WHEN n.days_lost <= 7 THEN '4-7 días'
                        WHEN n.days_lost <= 14 THEN '8-14 días'
                        WHEN n.days_lost <= 30 THEN '15-30 días'
                        ELSE 'Más de 30 días'
                    END AS label,
                    COUNT(*) AS value
                  FROM non_fatal_accidents n
                  WHERE n.year = @year
                  GROUP BY label
                  ORDER BY 
                    CASE label
                        WHEN '1-3 días' THEN 1
                        WHEN '4-7 días' THEN 2
                        WHEN '8-14 días' THEN 3
                        WHEN '15-30 días' THEN 4
                        ELSE 5
                    END`
            }
        };

        const query = queries[accidentType]?.[segmentType];

        if (!query) {
            const validOptions = Object.keys(queries[accidentType] || []);
            return res.status(400).json({
                error: 'Segmentación no válida',
                accidentType,
                validSegmentations: validOptions
            });
        }

        const data = await executeQuery(req.app.locals.db, query, { year });

        res.json({
            status: 'success',
            accidentType,
            segmentType,
            year,
            count: data.length,
            data
        });
    } catch (err) {
        console.error(`GET /${accidentType}/${segmentType}:`, err);
        res.status(500).json({
            error: 'Error al procesar la solicitud',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Estadísticas resumen
router.get('/summary', validateYear, async (req, res) => {
    const year = req.validatedYear;

    try {
        const query = `
            SELECT 'Fatal' AS type, COUNT(*) AS count
            FROM fatal_accidents WHERE year = @year
            UNION ALL
            SELECT 'Non-fatal' AS type, COUNT(*) AS count
            FROM non_fatal_accidents WHERE year = @year`;

        const data = await executeQuery(req.app.locals.db, query, { year });

        res.json({
            status: 'success',
            year,
            data: {
                fatal: data.find(d => d.type === 'Fatal')?.count || 0,
                nonFatal: data.find(d => d.type === 'Non-fatal')?.count || 0
            }
        });
    } catch (err) {
        console.error('GET /summary:', err);
        res.status(500).json({
            error: 'Error al obtener resumen',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;