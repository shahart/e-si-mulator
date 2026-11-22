import type { Action, CalculatorMode, KeyAction, ProgramBank, ProgramCommand, ProgramStep } from './types.js';

type Operation = 'add' | 'subtract' | 'multiply' | 'divide';
export type ExecutionStatus = 'idle' | 'running' | 'input' | 'output' | 'halt' | 'finished' | 'error';
const LIMIT = 10000;
const isCommand = (a: KeyAction): a is ProgramCommand => /^(kin|kout)[1-6]$/.test(a)
  || ['min','mr','halt','input','return','loopPositive','loopLessEqual'].includes(a);

export interface CalculatorState {
  display: number | string; accumulator: number | null; pending: Operation | null; fresh: boolean;
  mode: CalculatorMode; bank: ProgramBank; angle: 'DEG' | 'RAD'; shift: boolean;
  programs: Record<ProgramBank, ProgramStep[]>; inputValue: number; error: string;
  memories: Array<number | null>; m: number | null; execution: ExecutionStatus;
  pc: number; waitingForInput: boolean; sequence: 'kin' | 'kout' | null;
}

export class Calculator {
  readonly state: CalculatorState = {
    display:'0', accumulator:null, pending:null, fresh:true, mode:'RUN', bank:'P1', angle:'DEG', shift:false,
    programs:{P1:[],P2:[]}, inputValue:0, error:'', memories:Array(6).fill(null), m:null,
    execution:'idle', pc:0, waitingForInput:false, sequence:null,
  };
  get totalSteps(): number { return this.state.programs.P1.length + this.state.programs.P2.length; }
  get availableSteps(): number { return 38 - this.state.programs[this.state.bank === 'P1' ? 'P2' : 'P1'].length; }

  press(action: KeyAction): void {
    const s=this.state; s.error='';
    if (s.sequence) {
      const seq=s.sequence; s.sequence=null;
      if (/^[1-6]$/.test(action)) { this.press(`${seq}${action}` as ProgramCommand); return; }
      this.press(action); return;
    }
    if(action==='shift'){s.shift=!s.shift;return;}
    if(action==='mode'){s.mode=s.mode==='RUN'?'MODE':'RUN';return;}
    if(s.mode==='MODE'&&action==='0'){s.mode='LRN';s.bank='P1';s.programs={P1:[],P2:[]};return;}
    if(s.mode==='LRN'&&action==='runP1'){s.bank='P1';return;}
    if(s.mode==='LRN'&&action==='runP2'){s.bank='P2';return;}
    if(s.mode==='LRN'&&action==='clear'){s.programs[s.bank]=[];return;}
    if(action==='runP1'||action==='runP2'){this.start(action==='runP1'?'P1':'P2');return;}
    if(action==='kin'||action==='kout'){s.sequence=action;return;}
    if(action==='execute'){
      if(s.execution==='input'){s.inputValue=this.value();s.waitingForInput=false;s.execution='running';this.resume();}
      else if(['halt','output'].includes(s.execution)){s.execution='running';this.resume();}
      return;
    }
    if(s.mode==='LRN'){
      if(this.totalSteps>=38){s.error='MEM FULL';return;}
      if(action==='halt'||action==='input'||isCommand(action)){
        s.programs[s.bank].push(action as ProgramStep);
        return;
      }
      s.programs[s.bank].push(action as ProgramStep);
    }
    if(action==='clear'){s.display='0';s.accumulator=null;s.pending=null;s.fresh=true;return;}
    if(isCommand(action)){
      if(action==='input'){s.execution='input';s.waitingForInput=true;s.display='0';s.fresh=true;}
      else if(action==='halt'){s.execution='halt';s.fresh=true;}
      else this.executeCommand(action);
      return;
    }
    this.perform(action as Action);
  }

  selectBank(bank:ProgramBank):void{this.state.bank=bank;}
  clearProgram(bank:ProgramBank=this.state.bank):void{this.state.programs[bank]=[];}
  loadProgram(bank:ProgramBank,steps:ProgramStep[]):void{this.state.programs[bank]=[...steps];this.state.bank=bank;this.state.mode='RUN';}
  private value():number{return Number(this.state.display)||0;}
  private start(bank:ProgramBank):void{const s=this.state;s.bank=bank;s.mode='RUN';s.inputValue=this.value();s.pc=0;s.accumulator=null;s.pending=null;s.fresh=true;s.execution='running';this.resume();}
  private resume():void{
    const s=this.state, program=s.programs[s.bank];let count=0;
    while(s.pc<program.length&&count++<LIMIT&&s.execution==='running'){
      const step=program[s.pc++];
      if(step==='x'){s.display=s.inputValue;s.fresh=false;continue;}
      if(step==='input'){s.execution='input';s.waitingForInput=true;s.display='0';s.fresh=true;return;}
      if(step==='halt'){s.execution='halt';s.fresh=true;return;}
      if(step==='return'){s.pc=0;continue;}
      if(step==='loopPositive'){if(this.value()>0)s.pc=0;continue;}
      if(step==='loopLessEqual'){if(this.value()<=(s.m??0))s.pc=0;continue;}
      if(isCommand(step)){this.executeCommand(step);continue;}
      this.perform(step as Action);
    }
    if(s.execution!=='running')return;
    if(count>=LIMIT&&s.pc<program.length){s.execution='error';s.error='PROGRAM LIMIT';return;}
    s.execution='finished';
  }
  private executeCommand(command:ProgramCommand):void{
    const s=this.state;
    if(command==='min'){s.m=this.value();return;}
    if(command==='mr'){this.set(s.m??0);return;}
    const match=/^(kin|kout)([1-6])$/.exec(command);
    if(match){const i=Number(match[2])-1;if(match[1]==='kin')s.memories[i]=this.value();else {this.set(s.memories[i]??0);if(s.execution==='running')s.execution='output';}}
  }
  private set(n:number):void{this.state.display=Number.isFinite(n)?n:'Math Error';this.state.fresh=true;}
  private perform(a:Action):void{
    const s=this.state;
    if(/^[0-9]$/.test(a)){s.display=s.fresh?a:(s.display==='0'?a:`${s.display}${a}`);s.fresh=false;return;}
    if(a==='decimal'){s.display=s.fresh?'0.':String(s.display).includes('.')?s.display:`${s.display}.`;s.fresh=false;return;}
    if(['add','subtract','multiply','divide'].includes(a)){
      const op=a as Operation;
      if(s.pending){
        const left=s.accumulator??this.value(), right=this.value();
        s.accumulator=s.pending==='add'?left+right:s.pending==='subtract'?left-right:s.pending==='multiply'?left*right:left/right;
        s.display=s.accumulator;
      } else s.accumulator=this.value();
      s.pending=op;s.fresh=true;return;
    }
    if(a==='equals'&&s.pending){const x=s.accumulator??0,y=this.value();this.set(s.pending==='add'?x+y:s.pending==='subtract'?x-y:s.pending==='multiply'?x*y:x/y);s.pending=null;s.accumulator=null;return;}
    const v=this.value(),rad=s.angle==='DEG'?v*Math.PI/180:v;
    if(a==='x')return;
    if(a==='square')this.set(v*v);else if(a==='sqrt')this.set(Math.sqrt(v));else if(a==='sin')this.set(Math.sin(rad));else if(a==='cos')this.set(Math.cos(rad));else if(a==='tan')this.set(Math.tan(rad));else if(a==='pi')this.set(Math.PI);else if(a==='negate')this.set(-v);
  }
}
