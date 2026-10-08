/**
 * Skill taxonomy used to read requirements out of free-text postings. It normalises vocabulary;
 * it does not decide which careers exist.
 */
export const SKILL_TAXONOMY: Array<{ name: string; aliases: string[]; category: string; baseImportance: number }> = [
  { name: 'Python', aliases: ['python'], category: 'TECHNICAL', baseImportance: 0.85 },
  { name: 'Java', aliases: ['java ', 'java,', 'spring boot', 'java/'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'JavaScript / TypeScript', aliases: ['javascript', 'typescript', 'react', 'node.js', 'nodejs', 'angular'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'SQL & Databases', aliases: ['sql', 'postgres', 'mysql', 'mongodb', 'database'], category: 'TECHNICAL', baseImportance: 0.75 },
  { name: 'Machine Learning', aliases: ['machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit', ' nlp', 'computer vision'], category: 'TECHNICAL', baseImportance: 0.9 },
  { name: 'Data Analysis', aliases: ['data analysis', 'pandas', 'excel', 'power bi', 'powerbi', 'tableau', 'dashboards'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Cloud Computing', aliases: ['aws', 'azure', 'gcp', 'cloud'], category: 'TECHNICAL', baseImportance: 0.75 },
  { name: 'DevOps & Docker', aliases: ['docker', 'kubernetes', 'ci/cd', 'devops', 'jenkins'], category: 'TECHNICAL', baseImportance: 0.75 },
  { name: 'Embedded & Electronics', aliases: ['embedded', 'arduino', 'microcontroller', 'pcb', 'electronics', 'iot', 'sensor'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'CAD & Mechanical Design', aliases: ['autocad', 'solidworks', 'catia', 'cad ', 'mechanical design', 'creo'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Electrical Systems', aliases: ['electrical', 'wiring', 'plc', 'scada', 'switchgear'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Robotics & Automation', aliases: ['robotics', 'automation', 'ros ', 'industrial automation'], category: 'TECHNICAL', baseImportance: 0.85 },
  { name: 'Environmental Science', aliases: ['environmental', 'pollution', 'ecology', 'effluent', 'wastewater', 'sustainability'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Laboratory Techniques', aliases: ['laboratory', 'lab ', 'microbiology', 'assay', 'pcr'], category: 'TECHNICAL', baseImportance: 0.75 },
  { name: 'Patient Care', aliases: ['patient care', 'nursing', 'clinical', 'patients', 'hospital'], category: 'COMMUNICATION', baseImportance: 0.85 },
  { name: 'Cooking & Food Preparation', aliases: ['cook', 'chef', 'culinary', 'kitchen', 'tandoor', 'baking', 'food preparation', 'south indian', 'north indian', 'chinese cuisine'], category: 'CREATIVE', baseImportance: 0.9 },
  { name: 'Food Safety & Hygiene', aliases: ['hygiene', 'food safety', 'fssai', 'haccp', 'sanitation'], category: 'TECHNICAL', baseImportance: 0.7 },
  { name: 'Customer Service', aliases: ['customer service', 'customer support', 'guest', 'hospitality', 'front office'], category: 'COMMUNICATION', baseImportance: 0.7 },
  { name: 'Sales & Negotiation', aliases: ['sales', 'negotiation', 'business development', 'lead generation', 'target'], category: 'COMMUNICATION', baseImportance: 0.75 },
  { name: 'Teaching & Mentoring', aliases: ['teaching', 'teacher', 'tutor', 'lesson', 'curriculum', 'students'], category: 'COMMUNICATION', baseImportance: 0.85 },
  { name: 'Accounting & Finance', aliases: ['accounting', 'tally', 'gst', 'bookkeeping', 'financial statements', 'audit', 'taxation'], category: 'COGNITIVE', baseImportance: 0.85 },
  { name: 'Digital Marketing', aliases: ['digital marketing', 'seo', 'social media', 'google ads', 'content marketing'], category: 'CREATIVE', baseImportance: 0.8 },
  { name: 'UI/UX Design', aliases: ['figma', 'ui/ux', 'user experience', 'prototyping', 'wireframe'], category: 'CREATIVE', baseImportance: 0.85 },
  { name: 'Graphic Design', aliases: ['photoshop', 'illustrator', 'graphic design', 'canva', 'coreldraw'], category: 'CREATIVE', baseImportance: 0.8 },
  { name: 'Writing & Content', aliases: ['content writing', 'copywriting', 'writing', 'editing', 'blog'], category: 'COMMUNICATION', baseImportance: 0.75 },
  { name: 'Communication', aliases: ['communication', 'presentation', 'interpersonal', 'english'], category: 'COMMUNICATION', baseImportance: 0.7 },
  { name: 'Project Management', aliases: ['agile', 'scrum', 'project management', 'stakeholder'], category: 'LEADERSHIP', baseImportance: 0.7 },
  { name: 'Team Leadership', aliases: ['team lead', 'supervis', 'manage a team', 'leadership'], category: 'LEADERSHIP', baseImportance: 0.7 },
  { name: 'Mathematics & Statistics', aliases: ['statistics', 'mathematics', 'calculus', 'quantitative', 'statistical'], category: 'COGNITIVE', baseImportance: 0.85 },
  { name: 'Agriculture', aliases: ['agricultur', 'farming', 'agronom', 'crop', 'horticulture', 'irrigation'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Textile & Garment', aliases: ['textile', 'garment', 'dyeing', 'knitting', 'apparel', 'merchandis'], category: 'TECHNICAL', baseImportance: 0.8 },
  { name: 'Driving & Logistics', aliases: ['driver', 'driving licence', 'driving license', 'logistics', 'delivery', 'warehouse'], category: 'TECHNICAL', baseImportance: 0.75 }
];


export const SKILL_NAMES: string[] = SKILL_TAXONOMY.map(s => s.name);
