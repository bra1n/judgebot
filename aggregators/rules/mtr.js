function MTR(){
    this.Location = "http://blogs.magicjudges.org/rules/mtr/";
    this.find = function(parameter,callback){

    };
}
MTR.prototype.getContent = function(parameter,callback){
    if(parameter){
        this.find(parameter,callback());
    }else{
        callback(this.Location);
    }

};

module.exports = MTR;