import { DebateTopic } from '../types';
import supabase from './supabase';

// Fetch debates from Supabase `coding_questions` table.
// Expected table columns:
// id, title, description, code, script, pre_conditions, post_conditions, invariants
export const getDebates = async (): Promise<DebateTopic[]> => {
  const { data, error } = await supabase
    .from('coding_questions')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Supabase getDebates error', error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    code: row.code,
    script: typeof row.script === 'string' ? JSON.parse(row.script) : row.script || [],
    preConditions: row.pre_conditions || row.preConditions || '',
    postConditions: row.post_conditions || row.postConditions || '',
    invariants: row.invariants || ''
  }));
};

// Insert a new debate topic into Supabase. Returns the inserted row or null on error.
export const insertDebate = async (topic: Omit<DebateTopic, 'id'>) => {
  const payload = {
    title: topic.title,
    description: topic.description,
    code: topic.code,
    script: JSON.stringify(topic.script),
    pre_conditions: topic.preConditions,
    post_conditions: topic.postConditions,
    invariants: topic.invariants
  };

  const { data, error } = await supabase
    .from('coding_questions')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Supabase insertDebate error', error);
    return null;
  }

  return data;
};