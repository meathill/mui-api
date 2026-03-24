/**
 * 轻量级 AWS Event Stream 二进制协议解码器
 * 用于解析 Bedrock ConverseStream / InvokeModelWithResponseStream 响应
 *
 * 帧格式：
 *   [total_length: 4B][headers_length: 4B][prelude_crc: 4B]
 *   [headers: N bytes][payload: M bytes][message_crc: 4B]
 *
 * @see https://docs.aws.amazon.com/transcribe/latest/dg/event-stream.html
 */

export interface AwsEventStreamMessage {
  headers: Record<string, string>;
  payload: Uint8Array;
}

/**
 * 从 ReadableStream 中逐条解析 AWS Event Stream 消息
 */
export async function* parseAwsEventStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<AwsEventStreamMessage> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      // 至少需要 12 字节 prelude
      while (buffer.byteLength < 12) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer = concat(buffer, value);
      }

      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const totalLength = view.getUint32(0);
      const headersLength = view.getUint32(4);

      // 读取完整消息
      while (buffer.byteLength < totalLength) {
        const { done, value } = await reader.read();
        if (done) throw new Error('AWS Event Stream: 意外的流结束');
        buffer = concat(buffer, value);
      }

      const headers = decodeHeaders(buffer.subarray(12, 12 + headersLength));
      const payloadLength = totalLength - headersLength - 16;
      const payload = buffer.subarray(12 + headersLength, 12 + headersLength + payloadLength);

      yield { headers, payload: payload.slice() };

      buffer = buffer.subarray(totalLength);
    }
  } finally {
    reader.releaseLock();
  }
}

function decodeHeaders(data: Uint8Array): Record<string, string> {
  const headers: Record<string, string> = {};
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset < data.byteLength) {
    const nameLength = data[offset];
    offset += 1;
    const name = decoder.decode(data.subarray(offset, offset + nameLength));
    offset += nameLength;

    const valueType = data[offset];
    offset += 1;

    if (valueType === 7) {
      // string 类型：2 字节长度 + N 字节值
      const valueLength = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      headers[name] = decoder.decode(data.subarray(offset, offset + valueLength));
      offset += valueLength;
    } else if (valueType === 0 || valueType === 1) {
      // bool true/false：无额外数据
      headers[name] = valueType === 0 ? 'true' : 'false';
    } else if (valueType === 2) {
      offset += 1; // byte
    } else if (valueType === 3) {
      offset += 2; // short
    } else if (valueType === 4) {
      offset += 4; // int
    } else if (valueType === 5 || valueType === 8) {
      offset += 8; // long / timestamp
    } else if (valueType === 6) {
      // bytes：2 字节长度 + N 字节
      const len = (data[offset] << 8) | data[offset + 1];
      offset += 2 + len;
    } else if (valueType === 9) {
      offset += 16; // uuid
    } else {
      break; // 未知类型，停止解析
    }
  }

  return headers;
}

function concat(a: Uint8Array<ArrayBufferLike>, b: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(a, 0);
  result.set(b, a.byteLength);
  return result;
}
