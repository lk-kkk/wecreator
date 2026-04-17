import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

export type MessageType = 'text' | 'image' | 'file';

@Schema({ collection: 'messages', timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class Message {
  @Prop({ required: true, index: true })
  conversationId: number;   // MySQL conversations.id

  @Prop({ required: true })
  senderId: number;

  @Prop({ required: true, enum: ['company', 'worker'] })
  senderType: 'company' | 'worker';

  @Prop({ required: true, enum: ['text', 'image', 'file'], default: 'text' })
  type: MessageType;

  @Prop({ required: true })
  content: string;           // 文字内容 / OSS URL

  @Prop({ type: String, default: null })
  fileName: string | null;   // 文件类型时的原始名

  @Prop({ type: Number, default: null })
  fileSize: number | null;   // 字节数

  @Prop({ type: [Number], default: [] })
  readBy: number[];          // 已读的 userId 列表

  @Prop()
  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });
