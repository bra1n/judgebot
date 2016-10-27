class IPG{
    constructor(){
        this.Location = "http://blogs.magicjudges.org/rules/ipg/";
    }
    find(parameter,callback){
        //todo
    }
    getContent(parameter,callback){
        if(parameter){
            this.find(parameter,callback());
        }else{
            callback(this.Location);
        }

    }
}
module.exports = IPG;