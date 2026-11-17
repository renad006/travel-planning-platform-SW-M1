import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// A malformed id in a URL (like /hotels/123) must answer 400, not crash with a 500 cast error
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
    transform(value: string, metadata: { data?: string }): string {
        if (!/^[0-9a-fA-F]{24}$/.test(value)) {
            throw new BadRequestException(`${metadata.data ?? 'id'} must be a valid id`);
        }
        return value;
    }
}
