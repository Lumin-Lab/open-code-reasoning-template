export enum Speaker {
  Tutor = 'Tutor AI',
  Student = 'Student AI',
  User = 'User'
}

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  isTyping?: boolean;
}

export interface CodeLine {
  text: string;
  indent: number;
}

export interface DebateState {
  isPlaying: boolean;
  speed: number; // 1 to 5
  currentTopic: string;
  currentSnippet: string;
}

export interface DebateTopic {
  id: number;
  title: string;
  description: string;
  code: string;
  script: Message[];
}
