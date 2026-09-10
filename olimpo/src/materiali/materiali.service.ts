import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AbsolutePaths } from 'src/models/absolute_path.model';
import { Materiali } from 'src/models/materiali.model';
import { Video, VideoAttributes } from 'src/models/video.model';

@Injectable()
export class MaterialiService {


    constructor(
        @InjectModel(Materiali) private readonly materialiModel: typeof Materiali,
        @InjectModel(Video) private readonly videoModel: typeof Video,
        @InjectModel(AbsolutePaths) private readonly absolutePathsModel: typeof AbsolutePaths,
    ) { }
    // Add your service methods here
    async checkFileMaterialeExistFromMD5(md5: string): Promise<Materiali> {
        try {
            await this.materialiModel.sync({ force: false });
            const existFileFromMD5 = await this.materialiModel.findOne({ where: { md5 } });
            if (!existFileFromMD5) {
                return null;
            }
            return existFileFromMD5;
        } catch (error) {
            console.error(error);
        }
    }

    async creaMaterialeRecord(materiale: Materiali): Promise<{ created: boolean,error: string }> {
        try {
            await this.materialiModel.sync({ force: false });
            await this.materialiModel.create(materiale.toJSON());
            return { created: true, error: "" };
        } catch (error) {
            console.error(error);
            return { created: false, error: error.message };
        }
    }

    async creaVideoRecord(video: VideoAttributes): Promise<{ created: boolean,error: string,file:string }> {
        try {
            await this.videoModel.sync({ force: false });
            const videoCreato = await this.videoModel.create(video);
            return { created: true, error: "", file: videoCreato.id };
        } catch (error) {
            console.error(error);
            return { created: false, error: error.message, file: "" };
        }
    }
    async checkFileVideoExistFromMD5(md5 :string){
        try {
            await this.videoModel.sync({ force: false });
            const existFileFromMD5 = await this.videoModel.findOne({ where: { md5 } });
            if (!existFileFromMD5) {
                return null;
            }
            return existFileFromMD5;
        } catch (error) {
            console.error(error);
        }
    }

    async getVideoFromGuidId(id: string): Promise<Video> {
        try {
            await this.videoModel.sync({ force: false });
            const video = await this.videoModel.findOne({ where: { id } });
            if (!video) {
                return null;
            }
            return video;
        } catch (error) {
            console.error(error);
        }
    }

    async getMaterialeFromId(id: string): Promise<Materiali> {
        try {
            await this.materialiModel.sync({ force: false });
            const materiale = await this.materialiModel.findOne({ where: { id } });
            if (!materiale) {
                return null;
            }
            return materiale;
        } catch (error) {
            console.error(error);
        }
    }

    async getAllMaterliFromIds(ids: string[]): Promise<Materiali[]> {
        try{
            await this.materialiModel.sync({force: false});
            const materiali = await this.materialiModel.findAll({where: {id: ids}});
            if(!materiali){
                return null;
            }
            return materiali;
        }catch(error){
            console.error(error);
        }
    }

    async getAllMateriali(): Promise<Materiali[]> {
        try {
            await this.materialiModel.sync({ force: false });
            const materiali = await this.materialiModel.findAll();
            return materiali || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async updateMaterialePagine(id: string, pagine: number): Promise<boolean> {
        try {
            await this.materialiModel.sync({ force: false });
            const materiale = await this.materialiModel.findOne({ where: { id } });
            if (!materiale) {
                return false;
            }
            materiale.pagine = pagine;
            await materiale.save();
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}