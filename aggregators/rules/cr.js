function CR(){
    this.Location = "http://blogs.magicjudges.org/rules/cr/";
    this.find = function(parameter,callback){

    };
}
CR.prototype.getContent = function(parameter,callback){
    if(parameter){
        this.find(parameter,callback());
    }else{
        callback(this.Location);
    }

};

module.exports = CR;